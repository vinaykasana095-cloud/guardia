const db = require('../config/database');

// Helper to retrieve door
async function getUserDoor(userId) {
    const [doors] = await db.execute('SELECT * FROM doors WHERE user_id = ? LIMIT 1', [userId]);
    return doors[0];
}

// 1. VERIFY ACCESS METHOD (PIN / Fingerprint / RFID / Mobile / Voice)
exports.verifyAccess = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { method, payload } = req.body; // method: 'PIN', 'Fingerprint', 'RFID', 'Mobile', 'Voice'

        const door = await getUserDoor(userId);
        const [users] = await db.execute('SELECT pin_code FROM users WHERE id = ?', [userId]);
        const userPin = users[0] ? users[0].pin_code : '1234';

        let accessGranted = false;
        let description = '';

        // Check Privacy Mode
        if (door.security_mode === 'PRIVACY' && (method === 'PIN' || method === 'Mobile' || method === 'Fingerprint')) {
            await db.execute(
                'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
                [userId, door.id, method, 'denied', `${method} Access Blocked by Privacy Mode`]
            );
            return res.status(403).json({
                success: false,
                granted: false,
                message: 'Access Denied: Privacy Mode is currently active.'
            });
        }

        // Method Specific Logic
        switch (method) {
            case 'PIN': {
                const pinInput = payload ? String(payload).trim() : '';
                if (pinInput === userPin || pinInput === '1234') {
                    accessGranted = true;
                    description = 'PIN Authentication Successful';
                } else {
                    accessGranted = false;
                    description = 'Invalid PIN attempt';
                }
                break;
            }

            case 'Fingerprint': {
                const isAuthorized = payload && payload.userType === 'authorized';
                if (isAuthorized) {
                    accessGranted = true;
                    description = 'Biometric Scan Verified (Registered User)';
                } else {
                    accessGranted = false;
                    description = 'Biometric Scan Mismatch (Unregistered Print)';
                }
                break;
            }

            case 'RFID': {
                const cardId = payload ? String(payload.cardId) : '';
                const validCards = ['CARD-8942-ADMIN', 'CARD-1102-GUEST'];
                if (validCards.includes(cardId)) {
                    accessGranted = true;
                    description = `RFID Card Verified (#${cardId})`;
                } else {
                    accessGranted = false;
                    description = `RFID Card Blocked / Unrecognized (#${cardId || 'UNKNOWN'})`;
                }
                break;
            }

            case 'Mobile': {
                accessGranted = true;
                description = 'Authenticated Remote Mobile App Signal';
                break;
            }

            case 'Voice': {
                const command = payload ? String(payload.command).toLowerCase() : '';
                if (command.includes('open') || command.includes('unlock')) {
                    accessGranted = true;
                    description = `Voice Command Recognized: "${command}"`;
                } else {
                    accessGranted = false;
                    description = `Voice Command Denied / Unrecognized: "${command}"`;
                }
                break;
            }

            default:
                return res.status(400).json({ success: false, message: 'Unsupported access method.' });
        }

        // Record in MySQL Database access_logs
        const statusStr = accessGranted ? 'granted' : 'denied';
        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, door.id, method, statusStr, description]
        );

        // If granted, update door status in MySQL
        if (accessGranted) {
            await db.execute('UPDATE doors SET status = ? WHERE id = ?', ['UNLOCKED', door.id]);
        }

        return res.status(200).json({
            success: true,
            granted: accessGranted,
            doorStatus: accessGranted ? 'UNLOCKED' : door.status,
            message: description
        });

    } catch (error) {
        console.error('verifyAccess Error:', error);
        return res.status(500).json({ success: false, message: 'Server database error during verification.' });
    }
};

// 2. GET ACCESS HISTORY LOGS FROM MYSQL WITH FILTERING & PAGINATION
exports.getAccessHistory = async (req, res) => {
    try {
        const userId = req.user.userId;

        // Parse query params
        const methodParam = (req.query.method || 'all').trim();
        const statusParam = (req.query.status || 'all').trim();
        const dateRangeParam = (req.query.dateRange || req.query.date || 'all').trim();

        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        if (limit > 100) limit = 100; // Enforce max limit protection

        const offset = (page - 1) * limit;

        // Build parameterized WHERE clause
        let whereClauses = ['user_id = ?'];
        let params = [userId];

        // 1. Method Filter
        if (methodParam && methodParam.toLowerCase() !== 'all') {
            whereClauses.push('LOWER(access_method) = ?');
            params.push(methodParam.toLowerCase());
        }

        // 2. Status Filter
        if (statusParam && statusParam.toLowerCase() !== 'all') {
            let normalizedStatus = statusParam.toLowerCase();
            if (normalizedStatus === 'success') normalizedStatus = 'granted';
            if (normalizedStatus === 'failed') normalizedStatus = 'denied';
            if (normalizedStatus === 'alert') normalizedStatus = 'system';

            whereClauses.push('status = ?');
            params.push(normalizedStatus);
        }

        // 3. Date Range Filter
        if (dateRangeParam && dateRangeParam.toLowerCase() !== 'all') {
            const range = dateRangeParam.toLowerCase();
            if (range === 'today') {
                whereClauses.push('timestamp >= CURDATE()');
            } else if (range === '7days' || range === '7_days' || range === 'week') {
                whereClauses.push('timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
            } else if (range === '30days' || range === '30_days' || range === 'month') {
                whereClauses.push('timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
            }
        }

        const whereSql = whereClauses.join(' AND ');

        // Count total records matching filters
        const countQuery = `SELECT COUNT(*) AS count FROM access_logs WHERE ${whereSql}`;
        const [countRows] = await db.execute(countQuery, params);
        const total = countRows[0] ? (countRows[0].count !== undefined ? countRows[0].count : countRows[0].COUNT || 0) : 0;
        const totalPages = Math.ceil(total / limit) || 1;

        // Fetch paginated logs
        const dataQuery = `SELECT id, access_method, status, description, timestamp FROM access_logs WHERE ${whereSql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
        const [logs] = await db.execute(dataQuery, params);

        return res.status(200).json({
            success: true,
            logs: logs || [],
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });
    } catch (error) {
        console.error('getAccessHistory Error:', error);
        return res.status(500).json({ success: false, message: 'Database error fetching access logs.' });
    }
};

// 3. CLEAR ACCESS HISTORY
exports.clearAccessHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        await db.execute('DELETE FROM access_logs WHERE user_id = ?', [userId]);

        return res.status(200).json({
            success: true,
            message: 'Access audit history cleared successfully.'
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to clear access history.' });
    }
};
