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

exports.logVoiceAttempt = async (req, res) => {
    try {
        const userId = req.user.userId;
        const door = await getUserDoor(userId);
        const { status, description } = req.body;

        const isDenied = (status || 'denied') === 'denied';
        let alarmTriggered = false;

        if (isDenied) {
            const securityTracker = require('../utils/securityTracker');
            const alarmCheck = await securityTracker.recordFailedAttempt(userId, door.id);
            alarmTriggered = alarmCheck.alarmTriggered;
        }

        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, 'VOICE', status || 'denied', description || 'Invalid voice command']
        );

        return res.status(200).json({
            success: true,
            alarmTriggered,
            message: alarmTriggered ? 'Multiple failed access attempts detected — Security Alarm Activated!' : 'Voice access log recorded.'
        });
    } catch (error) {
        console.error('logVoiceAttempt Error:', error);
        return res.status(500).json({ success: false, message: 'Failed to record voice command log.' });
    }
};
