const db = require('../config/database');
const bcrypt = require('bcryptjs');

const PIN_REGEX = /^(\d{4}|\d{6})$/;

// In-memory Brute-Force Lockout Tracker per User ID
// Structure: { [userId]: { count: number, lockoutUntil: timestamp } }
const failedPinTracker = {};

// Helper to get or create isolated door
async function getUserDoor(userId) {
    let [doors] = await db.execute('SELECT * FROM doors WHERE user_id = ? LIMIT 1', [userId]);
    if (doors.length === 0) {
        const [insertRes] = await db.execute(
            'INSERT INTO doors (user_id, door_name, status, security_mode, power_status, battery_level, alarm_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'Main Door', 'LOCKED', 'NORMAL', 'AC', 100, 0]
        );
        [doors] = await db.execute('SELECT * FROM doors WHERE id = ? AND user_id = ?', [insertRes.insertId, userId]);
    }
    return doors[0];
}

// Helper to get or initialize user PIN credential hash
async function getUserPinHash(userId, doorId) {
    const [creds] = await db.execute(
        'SELECT credential_hash FROM access_credentials WHERE user_id = ? AND door_id = ? AND method = ? LIMIT 1',
        [userId, doorId, 'PIN']
    );

    if (creds.length > 0) {
        return creds[0].credential_hash;
    }

    // Default Fallback: Fetch user's pin_code or default '1234' and store bcrypt hash
    const [users] = await db.execute('SELECT pin_code FROM users WHERE id = ?', [userId]);
    const plainPin = (users[0] && users[0].pin_code) ? users[0].pin_code : '1234';
    const hash = await bcrypt.hash(plainPin, 10);

    await db.execute(
        'INSERT INTO access_credentials (user_id, door_id, method, credential_hash) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE credential_hash = VALUES(credential_hash)',
        [userId, doorId, 'PIN', hash]
    );

    return hash;
}

// 1. VERIFY PIN
exports.verifyPin = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { pin } = req.body;

        // Check 30-Second Lockout Rule
        const tracker = failedPinTracker[userId] || { count: 0, lockoutUntil: 0 };
        if (Date.now() < tracker.lockoutUntil) {
            const remainingSeconds = Math.ceil((tracker.lockoutUntil - Date.now()) / 1000);
            return res.status(429).json({
                success: false,
                lockout: true,
                lockoutSeconds: remainingSeconds,
                message: `Too many failed attempts. PIN access temporarily locked for ${remainingSeconds}s.`
            });
        }

        // Validate Input Format
        if (!pin || !PIN_REGEX.test(String(pin).trim())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid PIN format. PIN must be exactly 4 or 6 numeric digits.'
            });
        }

        const cleanPin = String(pin).trim();
        const door = await getUserDoor(userId);

        // Check Privacy Mode
        if (door.security_mode === 'PRIVACY') {
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'PIN', 'denied', 'PIN Verification Blocked by Privacy Mode']
            );
            return res.status(403).json({
                success: false,
                message: 'Access Denied: Privacy Mode is currently active.'
            });
        }

        // Get stored bcrypt hash
        const storedHash = await getUserPinHash(userId, door.id);
        const isMatch = await bcrypt.compare(cleanPin, storedHash);

        if (!isMatch) {
            // Increment failed attempt counter & check automatic alarm trigger threshold
            const securityTracker = require('../utils/securityTracker');
            const alarmCheck = await securityTracker.recordFailedAttempt(userId, door.id);

            tracker.count = (tracker.count || 0) + 1;

            if (tracker.count >= 5 || alarmCheck.alarmTriggered) {
                tracker.lockoutUntil = Date.now() + 30000; // 30 seconds lockout
                tracker.count = 0; // Reset counter for after lockout
                failedPinTracker[userId] = tracker;

                await db.execute(
                    'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, door.id, 'PIN', 'denied', '5 Consecutive Failed PIN Attempts — Lockout & Alarm Triggered']
                );

                return res.status(429).json({
                    success: false,
                    lockout: true,
                    alarmTriggered: true,
                    lockoutSeconds: 30,
                    message: 'Multiple failed access attempts detected — Security Alarm Activated!'
                });
            }

            failedPinTracker[userId] = tracker;

            // Log Failed Attempt (NEVER storing plain PIN or hash!)
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'PIN', 'denied', 'Invalid PIN attempt']
            );

            return res.status(401).json({
                success: false,
                message: 'ACCESS DENIED: Invalid PIN.'
            });
        }

        // SUCCESSFUL PIN VERIFICATION
        const securityTracker = require('../utils/securityTracker');
        securityTracker.resetFailedAttempts(userId);
        failedPinTracker[userId] = { count: 0, lockoutUntil: 0 }; // Reset fail tracker

        let responseMessage = 'PIN VERIFIED: Access Granted.';
        let newDoorStatus = door.status;

        if (door.status === 'LOCKED') {
            await db.execute('UPDATE doors SET status = ? WHERE id = ? AND user_id = ?', ['UNLOCKED', door.id, userId]);
            newDoorStatus = 'UNLOCKED';
            responseMessage = 'PIN VERIFIED: Access Granted — Unlocking Door...';

            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'PIN', 'granted', 'PIN authentication successful — Door Unlocked']
            );
        } else if (door.status === 'UNLOCKED') {
            responseMessage = 'PIN Verified. Door is already unlocked.';
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'PIN', 'granted', 'PIN authentication successful (Door already unlocked)']
            );
        } else if (door.status === 'OPEN') {
            responseMessage = 'PIN Verified. Door is currently open.';
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'PIN', 'granted', 'PIN authentication successful (Door is open)']
            );
        }

        return res.status(200).json({
            success: true,
            granted: true,
            doorStatus: newDoorStatus,
            message: responseMessage
        });

    } catch (error) {
        console.error('verifyPin Error:', error);
        return res.status(500).json({ success: false, message: 'Database error verifying PIN.' });
    }
};

// 2. SET / CHANGE PIN
exports.changePin = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPin, newPin, confirmNewPin } = req.body;

        if (!newPin || !confirmNewPin) {
            return res.status(400).json({ success: false, message: 'Please enter New PIN and Confirm New PIN.' });
        }

        const cleanNewPin = String(newPin).trim();
        const cleanConfirmPin = String(confirmNewPin).trim();

        if (!PIN_REGEX.test(cleanNewPin)) {
            return res.status(400).json({ success: false, message: 'PIN must be exactly 4 or 6 numeric digits.' });
        }

        if (cleanNewPin !== cleanConfirmPin) {
            return res.status(400).json({ success: false, message: 'New PIN and Confirm New PIN do not match.' });
        }

        const door = await getUserDoor(userId);
        const storedHash = await getUserPinHash(userId, door.id);

        // Verify current PIN if user already has an active credential
        if (currentPin) {
            const isMatch = await bcrypt.compare(String(currentPin).trim(), storedHash);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Current PIN is incorrect.' });
            }
        }

        // Hash new PIN with bcrypt (10 rounds)
        const newHash = await bcrypt.hash(cleanNewPin, 10);

        // Upsert into access_credentials (stores bcrypt hash only)
        await db.execute(
            'INSERT INTO access_credentials (user_id, door_id, method, credential_hash) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE credential_hash = VALUES(credential_hash)',
            [userId, door.id, 'PIN', newHash]
        );

        // Audit Log
        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'PIN', 'system', 'Security PIN Credential Updated']
        );

        return res.status(200).json({
            success: true,
            message: 'Security PIN updated successfully.'
        });

    } catch (error) {
        console.error('changePin Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update PIN in database.' });
    }
};
