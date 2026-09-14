const db = require('../config/database');

// Helper to retrieve or initialize door for user
async function getUserDoor(userId) {
    let [doors] = await db.execute('SELECT * FROM doors WHERE user_id = ? LIMIT 1', [userId]);
    if (doors.length === 0) {
        const [insertRes] = await db.execute(
            'INSERT INTO doors (user_id, door_name, status, security_mode, power_status, battery_level, alarm_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, 'Main Entrance Door', 'LOCKED', 'NORMAL', 'AC', 100, 0]
        );
        [doors] = await db.execute('SELECT * FROM doors WHERE id = ? AND user_id = ?', [insertRes.insertId, userId]);
    }
    return doors[0];
}

// 1. GET DASHBOARD SUMMARY (GET /api/dashboard/summary)
exports.getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Fetch User profile (never exposing password_hash or pin_code)
        const [users] = await db.execute('SELECT id, name, email FROM users WHERE id = ?', [userId]);
        const user = users[0] || { id: userId, name: 'GUARDIA User', email: '' };

        // Fetch Door state
        const door = await getUserDoor(userId);

        // Calculate User Statistics strictly for req.user.userId
        const [totalRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status IN ('granted', 'denied')", [userId]);
        const [successRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status = 'granted'", [userId]);
        const [failedRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status = 'denied'", [userId]);
        const [eventRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status = 'system'", [userId]);

        const stats = {
            totalAttempts: totalRows[0] ? (totalRows[0].count !== undefined ? totalRows[0].count : totalRows[0].COUNT || 0) : 0,
            successfulAccess: successRows[0] ? (successRows[0].count !== undefined ? successRows[0].count : successRows[0].COUNT || 0) : 0,
            failedAccess: failedRows[0] ? (failedRows[0].count !== undefined ? failedRows[0].count : failedRows[0].COUNT || 0) : 0,
            securityEvents: eventRows[0] ? (eventRows[0].count !== undefined ? eventRows[0].count : eventRows[0].COUNT || 0) : 0
        };

        // Fetch Recent Activity (latest 10 logs)
        const [recentActivity] = await db.execute(
            'SELECT id, access_method, status, description, timestamp FROM access_logs WHERE user_id = ? ORDER BY id DESC LIMIT 10',
            [userId]
        );

        // Access Methods status list
        const accessMethods = [
            { id: 'pin', name: 'PIN Access', icon: '🔢', status: 'ENABLED' },
            { id: 'fingerprint', name: 'Fingerprint Scanner', icon: '👆', status: 'ENABLED' },
            { id: 'rfid', name: 'RFID Smart Card', icon: '🪪', status: 'ENABLED' },
            { id: 'mobile', name: 'Mobile App Control', icon: '📱', status: 'ENABLED' },
            { id: 'voice', name: 'Voice Command', icon: '🎙️', status: 'ENABLED' }
        ];

        return res.status(200).json({
            success: true,
            summary: {
                user: {
                    name: user.name,
                    email: user.email
                },
                door: {
                    id: door.id,
                    door_name: door.door_name,
                    status: door.status,
                    security_mode: door.security_mode,
                    power_status: door.power_status,
                    battery_level: door.battery_level || 100,
                    alarm_status: door.alarm_status === 1 ? 1 : 0
                },
                stats,
                recentActivity: recentActivity || [],
                accessMethods
            }
        });
    } catch (error) {
        console.error('getDashboardSummary Error:', error);
        return res.status(500).json({ success: false, message: 'Server database error loading dashboard summary.' });
    }
};

// 2. GET DASHBOARD STATS (GET /api/dashboard/stats)
exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.userId;

        const [totalRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status IN ('granted', 'denied')", [userId]);
        const [successRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status = 'granted'", [userId]);
        const [failedRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status = 'denied'", [userId]);
        const [eventRows] = await db.execute("SELECT COUNT(*) AS count FROM access_logs WHERE user_id = ? AND status = 'system'", [userId]);

        const stats = {
            totalAttempts: totalRows[0] ? (totalRows[0].count !== undefined ? totalRows[0].count : totalRows[0].COUNT || 0) : 0,
            successfulAccess: successRows[0] ? (successRows[0].count !== undefined ? successRows[0].count : successRows[0].COUNT || 0) : 0,
            failedAccess: failedRows[0] ? (failedRows[0].count !== undefined ? failedRows[0].count : failedRows[0].COUNT || 0) : 0,
            securityEvents: eventRows[0] ? (eventRows[0].count !== undefined ? eventRows[0].count : eventRows[0].COUNT || 0) : 0
        };

        return res.status(200).json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('getDashboardStats Error:', error);
        return res.status(500).json({ success: false, message: 'Server database error fetching dashboard stats.' });
    }
};
