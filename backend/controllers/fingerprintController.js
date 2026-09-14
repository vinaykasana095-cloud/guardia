const db = require('../config/database');
const bcrypt = require('bcryptjs');

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

// Helper to get or initialize user simulated fingerprint credential hash
async function getUserFingerprintCredential(userId, doorId) {
    const [creds] = await db.execute(
        'SELECT credential_hash FROM access_credentials WHERE user_id = ? AND door_id = ? AND method = ? LIMIT 1',
        [userId, doorId, 'FINGERPRINT']
    );

    if (creds.length > 0) {
        return creds[0].credential_hash;
    }

    // Generate safe simulated biometric token hash (never storing raw biometric data!)
    const simulatedToken = `FP_SIM_TOKEN_USER_${userId}`;
    const hash = await bcrypt.hash(simulatedToken, 10);

    await db.execute(
        'INSERT INTO access_credentials (user_id, door_id, method, credential_hash) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE credential_hash = VALUES(credential_hash)',
        [userId, doorId, 'FINGERPRINT', hash]
    );

    return hash;
}

/**
 * VERIFY FINGERPRINT SIMULATION
 * POST /api/access/fingerprint/verify
 */
exports.verifyFingerprint = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { simulatedPrint, printType } = req.body;
        const scanType = printType || simulatedPrint || 'authorized';

        const door = await getUserDoor(userId);

        // 1. Check Privacy Mode Shield
        if (door.security_mode === 'PRIVACY') {
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'FINGERPRINT', 'denied', 'Fingerprint Verification Blocked by Privacy Mode']
            );
            return res.status(403).json({
                success: false,
                granted: false,
                message: 'Access Denied: Privacy Mode is currently active.'
            });
        }

        // 2. Fetch or Initialize Simulated Fingerprint Credential
        const storedHash = await getUserFingerprintCredential(userId, door.id);

        // 3. Handle Unrecognized / Invalid Print Simulation
        if (scanType === 'unauthorized' || scanType === 'invalid') {
            const securityTracker = require('../utils/securityTracker');
            const alarmCheck = await securityTracker.recordFailedAttempt(userId, door.id);

            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'FINGERPRINT', 'denied', 'Fingerprint not recognized']
            );

            return res.status(401).json({
                success: false,
                granted: false,
                alarmTriggered: alarmCheck.alarmTriggered,
                message: alarmCheck.alarmTriggered 
                    ? 'Multiple failed access attempts detected — Security Alarm Activated!' 
                    : 'FINGERPRINT NOT RECOGNIZED: Access Denied.'
            });
        }

        // 4. Verify Registered Simulated Print against stored bcrypt hash
        const simulatedToken = `FP_SIM_TOKEN_USER_${userId}`;
        const isMatch = await bcrypt.compare(simulatedToken, storedHash);

        if (!isMatch) {
            const securityTracker = require('../utils/securityTracker');
            const alarmCheck = await securityTracker.recordFailedAttempt(userId, door.id);

            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'FINGERPRINT', 'denied', 'Fingerprint verification failure']
            );

            return res.status(401).json({
                success: false,
                granted: false,
                alarmTriggered: alarmCheck.alarmTriggered,
                message: alarmCheck.alarmTriggered 
                    ? 'Multiple failed access attempts detected — Security Alarm Activated!' 
                    : 'FINGERPRINT NOT RECOGNIZED: Credential mismatch.'
            });
        }

        // 5. SUCCESSFUL FINGERPRINT VERIFICATION
        const securityTracker = require('../utils/securityTracker');
        securityTracker.resetFailedAttempts(userId);
        let responseMessage = 'FINGERPRINT VERIFIED: Access Granted.';
        let newDoorStatus = door.status;

        if (door.status === 'LOCKED') {
            await db.execute('UPDATE doors SET status = ? WHERE id = ? AND user_id = ?', ['UNLOCKED', door.id, userId]);
            newDoorStatus = 'UNLOCKED';
            responseMessage = 'FINGERPRINT VERIFIED: Access Granted — Unlocking Door...';

            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'FINGERPRINT', 'granted', 'Fingerprint authentication successful — Door Unlocked']
            );
        } else if (door.status === 'UNLOCKED') {
            responseMessage = 'Fingerprint Verified. Door is already unlocked.';
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'FINGERPRINT', 'granted', 'Fingerprint authentication successful (Door already unlocked)']
            );
        } else if (door.status === 'OPEN') {
            responseMessage = 'Fingerprint Verified. Door is currently open.';
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'FINGERPRINT', 'granted', 'Fingerprint authentication successful (Door is open)']
            );
        }

        return res.status(200).json({
            success: true,
            granted: true,
            doorStatus: newDoorStatus,
            message: responseMessage
        });

    } catch (error) {
        console.error('verifyFingerprint Error:', error);
        return res.status(500).json({ success: false, message: 'Database error processing fingerprint scan.' });
    }
};
