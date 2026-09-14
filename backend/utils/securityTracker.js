const db = require('../config/database');

// Structure: { [userId]: { count: number, lastFailedTime: number } }
const failedAttemptsTracker = {};

exports.recordFailedAttempt = async (userId, doorId) => {
    if (!failedAttemptsTracker[userId]) {
        failedAttemptsTracker[userId] = { count: 0, lastFailedTime: Date.now() };
    }
    
    // Reset counter if previous failed attempt was more than 5 minutes ago
    if (Date.now() - failedAttemptsTracker[userId].lastFailedTime > 5 * 60 * 1000) {
        failedAttemptsTracker[userId].count = 0;
    }

    failedAttemptsTracker[userId].count += 1;
    failedAttemptsTracker[userId].lastFailedTime = Date.now();

    console.log(`⚠️ User ${userId} Failed Attempt Count: ${failedAttemptsTracker[userId].count}`);

    if (failedAttemptsTracker[userId].count >= 5) {
        failedAttemptsTracker[userId].count = 0; // Reset counter

        // Check if Alarm System is currently ARMED (alarm_status === 1)
        const [doors] = await db.execute('SELECT alarm_status FROM doors WHERE id = ? AND user_id = ?', [doorId, userId]);
        const isArmed = doors.length > 0 && Number(doors[0].alarm_status) === 1;

        if (isArmed) {
            // Alarm is ARMED (ON) -> Siren audio & alert overlay MUST trigger!
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, doorId, 'SYSTEM', 'system', 'Alarm Siren automatically triggered after 5 failed attempts while ARMED']
            );

            return {
                alarmTriggered: true,
                lockout: true,
                message: 'Multiple failed access attempts detected — Security Alarm Siren Activated!'
            };
        } else {
            // Alarm is DISARMED (OFF) -> Enforce 30s Lockout ONLY (NO Siren Audio!)
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, doorId, 'SYSTEM', 'denied', '5 Consecutive Failed Attempts — 30s Lockout Enforced (Alarm Disarmed)']
            );

            return {
                alarmTriggered: false,
                lockout: true,
                message: 'Too many failed access attempts. PIN access temporarily locked for 30 seconds.'
            };
        }
    }

    return { alarmTriggered: false, lockout: false, count: failedAttemptsTracker[userId].count };
};

exports.resetFailedAttempts = (userId) => {
    if (failedAttemptsTracker[userId]) {
        failedAttemptsTracker[userId].count = 0;
    }
};
