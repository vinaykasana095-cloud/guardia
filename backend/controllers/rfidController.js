const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Ensure database schema supports multiple RFID credential records per user/door
async function ensureRfidIndexSupport() {
    try {
        await db.execute('ALTER TABLE access_credentials DROP INDEX unique_user_door_method');
        await db.execute('ALTER TABLE access_credentials ADD UNIQUE KEY unique_user_door_cred (user_id, door_id, method, credential_hash)');
    } catch (e) {
        // Safe ignore if index was already altered or dropped
    }
}

// Helper to get or create isolated door for user
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

// Helper to initialize default demo RFID cards if user has none
async function getUserRfidCredentials(userId, doorId) {
    await ensureRfidIndexSupport();

    const [creds] = await db.execute(
        'SELECT * FROM access_credentials WHERE user_id = ? AND door_id = ? AND method = ?',
        [userId, doorId, 'RFID']
    );

    if (creds.length > 0) {
        return creds;
    }

    // Auto-seed default authorized demo cards: ADMIN PASS and GUEST PASS
    const defaultCards = ['CARD-8942-ADMIN', 'CARD-1102-GUEST'];
    for (const cardCode of defaultCards) {
        const hash = await bcrypt.hash(cardCode, 10);
        await db.execute(
            'INSERT INTO access_credentials (user_id, door_id, method, credential_hash) VALUES (?, ?, ?, ?)',
            [userId, doorId, 'RFID', hash]
        );
    }

    const [newCreds] = await db.execute(
        'SELECT * FROM access_credentials WHERE user_id = ? AND door_id = ? AND method = ?',
        [userId, doorId, 'RFID']
    );
    return newCreds;
}

/**
 * 1. VERIFY RFID CARD SIMULATION
 * POST /api/access/rfid/verify
 */
exports.verifyRfid = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cardId, cardType } = req.body;
        const targetCard = String(cardId || cardType || '').trim();

        if (!targetCard) {
            return res.status(400).json({ success: false, message: 'Please provide a valid RFID card identifier.' });
        }

        const door = await getUserDoor(userId);

        // Check Privacy Mode
        if (door.security_mode === 'PRIVACY') {
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'RFID', 'denied', 'RFID Scan Blocked by Privacy Mode']
            );
            return res.status(403).json({
                success: false,
                granted: false,
                message: 'Access Denied: Privacy Mode is currently active.'
            });
        }

        // Fetch user's registered RFID cards
        const userCards = await getUserRfidCredentials(userId, door.id);

        // Test submitted RFID card against registered bcrypt hashes
        let matched = false;
        for (const cardRow of userCards) {
            const isMatch = await bcrypt.compare(targetCard, cardRow.credential_hash);
            if (isMatch) {
                matched = true;
                break;
            }
        }

        if (!matched) {
            // Unauthorized or Expired Card -> Record failed attempt for automatic alarm
            const securityTracker = require('../utils/securityTracker');
            const alarmCheck = await securityTracker.recordFailedAttempt(userId, door.id);

            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'RFID', 'denied', 'Unauthorized RFID card attempt']
            );

            return res.status(401).json({
                success: false,
                granted: false,
                alarmTriggered: alarmCheck.alarmTriggered,
                message: alarmCheck.alarmTriggered 
                    ? 'Multiple failed access attempts detected — Security Alarm Activated!' 
                    : 'UNAUTHORIZED RFID CARD: Access Denied.'
            });
        }

        // SUCCESSFUL RFID VERIFICATION
        const securityTracker = require('../utils/securityTracker');
        securityTracker.resetFailedAttempts(userId);

        // SUCCESSFUL RFID VERIFICATION
        let responseMessage = 'RFID CARD VERIFIED: Access Granted.';
        let newDoorStatus = door.status;

        if (door.status === 'LOCKED') {
            await db.execute('UPDATE doors SET status = ? WHERE id = ? AND user_id = ?', ['UNLOCKED', door.id, userId]);
            newDoorStatus = 'UNLOCKED';
            responseMessage = 'RFID CARD VERIFIED: Access Granted — Unlocking Door...';

            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'RFID', 'granted', 'Authorized RFID card scanned — Door Unlocked']
            );
        } else if (door.status === 'UNLOCKED') {
            responseMessage = 'RFID Card Verified. Door is already unlocked.';
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'RFID', 'granted', 'Authorized RFID card scanned (Door already unlocked)']
            );
        } else if (door.status === 'OPEN') {
            responseMessage = 'RFID Card Verified. Door is currently open.';
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, 'RFID', 'granted', 'Authorized RFID card scanned (Door is open)']
            );
        }

        return res.status(200).json({
            success: true,
            granted: true,
            doorStatus: newDoorStatus,
            message: responseMessage
        });

    } catch (error) {
        console.error('verifyRfid Error:', error);
        return res.status(500).json({ success: false, message: 'Database error processing RFID scan.' });
    }
};

/**
 * 2. GET USER REGISTERED RFID CARDS LIST
 * GET /api/access/rfid/cards
 */
exports.getUserCards = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const creds = await getUserRfidCredentials(userId, door.id);

        const safeCards = creds.map((c, idx) => ({
            id: c.id,
            cardLabel: idx === 0 ? 'ADMIN PASS' : (idx === 1 ? 'GUEST PASS' : `CARD PASS #${c.id}`),
            maskedCode: `•••• •••• ${1000 + c.id}`,
            createdAt: c.created_at
        }));

        return res.status(200).json({ success: true, cards: safeCards });
    } catch (error) {
        console.error('getUserCards Error:', error);
        return res.status(500).json({ success: false, message: 'Error retrieving RFID cards.' });
    }
};

/**
 * 3. REGISTER NEW SIMULATED RFID CARD
 * POST /api/access/rfid/cards
 */
exports.addCard = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { cardName, cardId } = req.body;

        if (!cardId || !String(cardId).trim()) {
            return res.status(400).json({ success: false, message: 'Please provide a valid RFID card code.' });
        }

        const cleanCode = String(cardId).trim();
        const door = await getUserDoor(userId);
        const hash = await bcrypt.hash(cleanCode, 10);

        await ensureRfidIndexSupport();
        await db.execute(
            'INSERT INTO access_credentials (user_id, door_id, method, credential_hash) VALUES (?, ?, ?, ?)',
            [userId, door.id, 'RFID', hash]
        );

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'RFID', 'system', `New RFID Card Registered (${cardName || 'Custom Card'})`]
        );

        return res.status(200).json({ success: true, message: 'New RFID card registered successfully.' });
    } catch (error) {
        console.error('addCard Error:', error);
        return res.status(500).json({ success: false, message: 'Error registering new RFID card.' });
    }
};

/**
 * 4. REVOKE / DELETE RFID CARD
 * DELETE /api/access/rfid/cards/:id
 */
exports.deleteCard = async (req, res) => {
    try {
        const userId = req.user.userId;
        const cardDbId = req.params.id;

        const door = await getUserDoor(userId);
        const [result] = await db.execute(
            'DELETE FROM access_credentials WHERE id = ? AND user_id = ? AND door_id = ? AND method = ?',
            [cardDbId, userId, door.id, 'RFID']
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'RFID Card credential not found.' });
        }

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'RFID', 'system', 'Authorized RFID Card Revoked']
        );

        return res.status(200).json({ success: true, message: 'RFID Card revoked successfully.' });
    } catch (error) {
        console.error('deleteCard Error:', error);
        return res.status(500).json({ success: false, message: 'Error revoking RFID card.' });
    }
};
