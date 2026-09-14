const db = require('../config/database');

// Helper to get or create isolated door record for authenticated user
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

// 1. GET DOOR STATUS & METRICS
exports.getDoorStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);

        const [successRows] = await db.execute(
            'SELECT COUNT(*) as cnt FROM access_logs WHERE user_id = ? AND door_id = ? AND status = ?',
            [userId, door.id, 'granted']
        );
        const [failedRows] = await db.execute(
            'SELECT COUNT(*) as cnt FROM access_logs WHERE user_id = ? AND door_id = ? AND status = ?',
            [userId, door.id, 'denied']
        );

        return res.status(200).json({
            success: true,
            door,
            stats: {
                success: successRows[0].cnt,
                failed: failedRows[0].cnt
            }
        });
    } catch (error) {
        console.error('getDoorStatus Error:', error);
        return res.status(500).json({ success: false, message: 'Database error retrieving door state.' });
    }
};

// 2. UNLOCK DOOR
exports.unlockDoor = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'Manual Control';

        if (door.security_mode === 'EMERGENCY') {
            if (method === 'MOBILE_APP' || method === 'VOICE') {
                const desc = method === 'VOICE' 
                    ? 'Voice command failed: Emergency Lockdown active'
                    : 'Remote unlock rejected: Emergency Lockdown active';
                await db.execute(
                    'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, door.id, method, 'denied', desc]
                );
            }
            return res.status(403).json({ success: false, message: 'Unlock operation rejected: Emergency Lockdown Mode active.' });
        }

        if (door.security_mode === 'PRIVACY' && (method === 'MOBILE_APP' || method === 'VOICE')) {
            const desc = method === 'VOICE'
                ? 'Voice command failed: Privacy Mode active'
                : 'Remote unlock rejected: Privacy Mode active';
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, method, 'denied', desc]
            );
            return res.status(403).json({ success: false, message: 'Access Denied: Privacy Mode is currently active.' });
        }

        if (door.status === 'OPEN') {
            if (method === 'MOBILE_APP' || method === 'VOICE') {
                const desc = method === 'VOICE'
                    ? 'Voice command failed: Door is open'
                    : 'Remote unlock rejected: Door is open';
                await db.execute(
                    'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, door.id, method, 'denied', desc]
                );
            }
            return res.status(400).json({ success: false, message: 'Door is currently open.' });
        }

        await db.execute('UPDATE doors SET status = ? WHERE id = ? AND user_id = ?', ['UNLOCKED', door.id, userId]);
        
        let logDesc = 'Door State Changed: UNLOCKED';
        if (method === 'MOBILE_APP') logDesc = 'Door unlocked remotely';
        else if (method === 'VOICE') logDesc = 'Voice command: unlock door';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, method, 'granted', logDesc]
        );

        return res.status(200).json({
            success: true,
            doorStatus: 'UNLOCKED',
            message: 'Door unlocked successfully.'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to unlock door in database.' });
    }
};

// 3. OPEN DOOR
exports.openDoor = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'Door Hardware';

        // Backend Rule Validation: Cannot open a locked door!
        if (door.status === 'LOCKED') {
            if (method === 'MOBILE_APP' || method === 'VOICE') {
                const desc = method === 'VOICE'
                    ? 'Voice command failed: Door is locked'
                    : 'Remote open rejected: Door is locked';
                await db.execute(
                    'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, door.id, method, 'denied', desc]
                );
            }
            return res.status(400).json({
                success: false,
                message: 'Access denied. Door is locked.'
            });
        }

        if (door.status === 'OPEN') {
            if (method === 'VOICE') {
                await db.execute(
                    'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, door.id, 'VOICE', 'denied', 'Voice command failed: Door is already open']
                );
            }
            return res.status(400).json({
                success: false,
                message: 'Door is already open.'
            });
        }

        await db.execute('UPDATE doors SET status = ? WHERE id = ? AND user_id = ?', ['OPEN', door.id, userId]);
        
        let logDesc = 'Door Swung Open';
        if (method === 'MOBILE_APP') logDesc = 'Door opened remotely';
        else if (method === 'VOICE') logDesc = 'Voice command: open door';
        const statusType = (method === 'MOBILE_APP' || method === 'VOICE') ? 'granted' : 'system';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, method, statusType, logDesc]
        );

        return res.status(200).json({
            success: true,
            doorStatus: 'OPEN',
            message: 'Door opened.'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to open door.' });
    }
};

// 4. CLOSE DOOR
exports.closeDoor = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'Door Hardware';

        if (door.status !== 'OPEN') {
            if (method === 'MOBILE_APP' || method === 'VOICE') {
                const desc = method === 'VOICE'
                    ? 'Voice command failed: Door is not open'
                    : 'Remote close rejected: Door is not open';
                await db.execute(
                    'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, door.id, method, 'denied', desc]
                );
            }
            return res.status(400).json({
                success: false,
                message: 'Door is not currently open.'
            });
        }

        await db.execute('UPDATE doors SET status = ? WHERE id = ? AND user_id = ?', ['UNLOCKED', door.id, userId]);
        
        let logDesc = 'Door Swung Closed';
        if (method === 'MOBILE_APP') logDesc = 'Door closed remotely';
        else if (method === 'VOICE') logDesc = 'Voice command: close door';
        const statusType = (method === 'MOBILE_APP' || method === 'VOICE') ? 'granted' : 'system';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, method, statusType, logDesc]
        );

        return res.status(200).json({
            success: true,
            doorStatus: 'UNLOCKED',
            message: 'Door closed.'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to close door.' });
    }
};

// 5. LOCK DOOR
exports.lockDoor = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'Manual Control';

        // Backend Rule Validation: Cannot lock an open door!
        if (door.status === 'OPEN') {
            if (method === 'MOBILE_APP' || method === 'VOICE') {
                const desc = method === 'VOICE'
                    ? 'Voice command failed: Close door before locking'
                    : 'Remote lock rejected: Close the door before locking';
                await db.execute(
                    'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                    [userId, door.id, method, 'denied', desc]
                );
            }
            return res.status(400).json({
                success: false,
                message: 'Must close door before locking.'
            });
        }

        await db.execute('UPDATE doors SET status = ? WHERE id = ? AND user_id = ?', ['LOCKED', door.id, userId]);
        
        let logDesc = 'Door State Changed: LOCKED & ENGAGED';
        if (method === 'MOBILE_APP') logDesc = 'Door locked remotely';
        else if (method === 'VOICE') logDesc = 'Voice command: lock door';
        const statusType = (method === 'MOBILE_APP' || method === 'VOICE') ? 'granted' : 'system';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, method, statusType, logDesc]
        );

        return res.status(200).json({
            success: true,
            doorStatus: 'LOCKED',
            message: 'Door locked successfully.'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to lock door in database.' });
    }
};
