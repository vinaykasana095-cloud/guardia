const db = require('../config/database');

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

// ==========================================================================
// 1. ALARM SYSTEM (POST /api/security/alarm/activate & /deactivate)
// ==========================================================================
exports.activateAlarm = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'SYSTEM';

        await db.execute('UPDATE doors SET alarm_status = 1 WHERE id = ?', [door.id]);

        const desc = method === 'VOICE' ? 'Voice command: activate alarm' : 'Security Alarm Activated';
        const methodType = method === 'VOICE' ? 'VOICE' : 'SYSTEM';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, methodType, 'system', desc]
        );

        return res.status(200).json({ success: true, alarmStatus: 1, message: desc });
    } catch (error) {
        console.error('activateAlarm Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to activate alarm.' });
    }
};

exports.deactivateAlarm = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'SYSTEM';

        await db.execute('UPDATE doors SET alarm_status = 0 WHERE id = ?', [door.id]);

        const desc = method === 'VOICE' ? 'Voice command: deactivate alarm' : 'Security Alarm Deactivated';
        const methodType = method === 'VOICE' ? 'VOICE' : 'SYSTEM';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, methodType, 'system', desc]
        );

        return res.status(200).json({ success: true, alarmStatus: 0, message: desc });
    } catch (error) {
        console.error('deactivateAlarm Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to deactivate alarm.' });
    }
};

exports.toggleAlarm = async (req, res) => {
    const door = await getUserDoor(req.user.userId);
    if (door.alarm_status === 1) return exports.deactivateAlarm(req, res);
    return exports.activateAlarm(req, res);
};

// ==========================================================================
// 2. EMERGENCY MODE (POST /api/security/emergency/activate & /deactivate)
// ==========================================================================
exports.activateEmergency = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);

        // Emergency Mode sets security_mode = 'EMERGENCY', locks door, and activates alarm
        await db.execute('UPDATE doors SET security_mode = ?, status = ?, alarm_status = 1 WHERE id = ?', 
            ['EMERGENCY', 'LOCKED', door.id]
        );

        const desc = 'Emergency Lockdown Mode Activated — All Access Sealed & Alarm Triggered';
        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'SYSTEM', 'system', desc]
        );

        return res.status(200).json({
            success: true,
            securityMode: 'EMERGENCY',
            alarmStatus: 1,
            doorStatus: 'LOCKED',
            message: desc
        });
    } catch (error) {
        console.error('activateEmergency Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to activate emergency mode.' });
    }
};

exports.deactivateEmergency = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);

        // Exiting emergency mode resets security_mode = 'NORMAL' and deactivates alarm
        await db.execute('UPDATE doors SET security_mode = ?, alarm_status = 0 WHERE id = ?', 
            ['NORMAL', door.id]
        );

        const desc = 'Emergency Lockdown Mode Exited — System Reset to Normal';
        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'SYSTEM', 'system', desc]
        );

        return res.status(200).json({
            success: true,
            securityMode: 'NORMAL',
            alarmStatus: 0,
            message: desc
        });
    } catch (error) {
        console.error('deactivateEmergency Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to deactivate emergency mode.' });
    }
};

exports.toggleEmergency = async (req, res) => {
    const door = await getUserDoor(req.user.userId);
    if (door.security_mode === 'EMERGENCY') return exports.deactivateEmergency(req, res);
    return exports.activateEmergency(req, res);
};

// ==========================================================================
// 3. PRIVACY MODE (POST /api/security/privacy/enable & /disable)
// ==========================================================================
exports.enablePrivacy = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'SYSTEM';

        // State Priority Rule: Emergency mode takes precedence over Privacy mode
        if (door.security_mode === 'EMERGENCY') {
            return res.status(400).json({
                success: false,
                message: 'Cannot enable Privacy Mode while Emergency Lockdown Mode is active.'
            });
        }

        await db.execute('UPDATE doors SET security_mode = ? WHERE id = ?', ['PRIVACY', door.id]);

        const desc = method === 'VOICE' 
            ? 'Voice command: enable privacy mode' 
            : 'Privacy Mode Enabled — Remote & Voice Access Restricted';
        const methodType = method === 'VOICE' ? 'VOICE' : 'SYSTEM';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, methodType, 'system', desc]
        );

        return res.status(200).json({ success: true, securityMode: 'PRIVACY', message: desc });
    } catch (error) {
        console.error('enablePrivacy Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to enable privacy mode.' });
    }
};

exports.disablePrivacy = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const method = req.body.method || 'SYSTEM';

        await db.execute('UPDATE doors SET security_mode = ? WHERE id = ?', ['NORMAL', door.id]);

        const desc = method === 'VOICE' 
            ? 'Voice command: disable privacy mode' 
            : 'Privacy Mode Disabled';
        const methodType = method === 'VOICE' ? 'VOICE' : 'SYSTEM';

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, methodType, 'system', desc]
        );

        return res.status(200).json({ success: true, securityMode: 'NORMAL', message: desc });
    } catch (error) {
        console.error('disablePrivacy Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to disable privacy mode.' });
    }
};

exports.togglePrivacy = async (req, res) => {
    const door = await getUserDoor(req.user.userId);
    if (door.security_mode === 'PRIVACY') return exports.disablePrivacy(req, res);
    return exports.enablePrivacy(req, res);
};

// ==========================================================================
// 4. POWER BACKUP SIMULATION (POST /api/security/power/failure & /restore)
// ==========================================================================
exports.simulatePowerFailure = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);

        await db.execute('UPDATE doors SET power_status = ? WHERE id = ?', ['BATTERY', door.id]);

        const desc = 'Main Power Failure Simulated — Switched to UPS Battery Backup';
        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'SYSTEM', 'system', desc]
        );

        return res.status(200).json({ success: true, powerStatus: 'BATTERY', message: desc });
    } catch (error) {
        console.error('simulatePowerFailure Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to simulate power failure.' });
    }
};

exports.restoreMainPower = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);

        await db.execute('UPDATE doors SET power_status = ? WHERE id = ?', ['AC', door.id]);

        const desc = 'Main AC Power Restored — Battery Recharging';
        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'SYSTEM', 'system', desc]
        );

        return res.status(200).json({ success: true, powerStatus: 'AC', message: desc });
    } catch (error) {
        console.error('restoreMainPower Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to restore main power.' });
    }
};

exports.togglePowerBackup = async (req, res) => {
    const door = await getUserDoor(req.user.userId);
    if (door.power_status === 'BATTERY') return exports.restoreMainPower(req, res);
    return exports.simulatePowerFailure(req, res);
};

exports.getSecurityStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);

        return res.status(200).json({
            success: true,
            security: {
                alarm: door.alarm_status === 1 ? 'ACTIVE' : 'OFF',
                emergency: door.security_mode === 'EMERGENCY' ? 'ACTIVE' : 'NORMAL',
                privacy: door.security_mode === 'PRIVACY' ? 'ACTIVE' : 'OFF',
                power: door.power_status === 'AC' ? 'MAIN' : 'BACKUP'
            }
        });
    } catch (error) {
        console.error('getSecurityStatus Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch security status.' });
    }
};
