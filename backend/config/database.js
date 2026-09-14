const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'guardia_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool = null;
let useMock = false;

const DB_FILE = path.join(__dirname, '../data/guardia_db.json');

const defaultPasswordHash = bcrypt.hashSync('password123', 10);
const defaultPinHash = bcrypt.hashSync('1234', 10);

function loadStoreFromDisk() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.users) && Array.isArray(data.doors)) {
                return data;
            }
        }
    } catch (e) {
        console.warn('⚠️ Could not load database from disk:', e.message);
    }
    return null;
}

function saveStoreToDisk() {
    try {
        const dataDir = path.dirname(DB_FILE);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(mockStore, null, 2), 'utf8');
    } catch (e) {
        console.warn('⚠️ Could not save database to disk:', e.message);
    }
}

function createDefaultStore() {
    return {
        users: [
            {
                id: 1,
                name: 'Alex Mercer',
                email: 'alex@guardia.com',
                password_hash: defaultPasswordHash,
                pin_code: '1234',
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                name: 'Alex Mercer',
                email: 'alex@example.com',
                password_hash: defaultPasswordHash,
                pin_code: '1234',
                created_at: new Date().toISOString()
            }
        ],
        doors: [
            {
                id: 1,
                user_id: 1,
                door_name: "Alex's Smart Door",
                status: 'LOCKED',
                security_mode: 'NORMAL',
                power_status: 'AC',
                battery_level: 100,
                alarm_status: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: 2,
                user_id: 2,
                door_name: "Alex's Smart Door",
                status: 'LOCKED',
                security_mode: 'NORMAL',
                power_status: 'AC',
                battery_level: 100,
                alarm_status: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ],
        access_credentials: [
            {
                id: 1,
                user_id: 1,
                door_id: 1,
                method: 'PIN',
                credential_hash: defaultPinHash,
                created_at: new Date().toISOString()
            },
            {
                id: 2,
                user_id: 2,
                door_id: 2,
                method: 'PIN',
                credential_hash: defaultPinHash,
                created_at: new Date().toISOString()
            }
        ],
        access_logs: [
            {
                id: 1,
                user_id: 1,
                door_id: 1,
                access_method: 'System Init',
                status: 'system',
                description: 'GUARDIA Database & User Account Online',
                timestamp: new Date().toISOString()
            }
        ]
    };
}

let mockStore = loadStoreFromDisk() || createDefaultStore();

// Ensure both demo users exist
if (!mockStore.users.some(u => (u.email || '').toLowerCase() === 'alex@guardia.com')) {
    mockStore.users.push({
        id: (Math.max(...mockStore.users.map(u => u.id || 0), 0) + 1),
        name: 'Alex Mercer',
        email: 'alex@guardia.com',
        password_hash: defaultPasswordHash,
        pin_code: '1234',
        created_at: new Date().toISOString()
    });
}
if (!mockStore.users.some(u => (u.email || '').toLowerCase() === 'alex@example.com')) {
    mockStore.users.push({
        id: (Math.max(...mockStore.users.map(u => u.id || 0), 0) + 1),
        name: 'Alex Mercer',
        email: 'alex@example.com',
        password_hash: defaultPasswordHash,
        pin_code: '1234',
        created_at: new Date().toISOString()
    });
}
saveStoreToDisk();

let nextIds = {
    users: Math.max(...mockStore.users.map(u => u.id || 0), 0) + 1,
    doors: Math.max(...mockStore.doors.map(d => d.id || 0), 0) + 1,
    access_credentials: Math.max(...mockStore.access_credentials.map(c => c.id || 0), 0) + 1,
    access_logs: Math.max(...mockStore.access_logs.map(l => l.id || 0), 0) + 1
};

// Initialize MySQL pool if available
try {
    pool = mysql.createPool(dbConfig);
} catch (e) {
    useMock = true;
}

(async () => {
    if (pool && !useMock) {
        try {
            const connection = await pool.getConnection();
            console.log('✅ Connected to MySQL Database:', process.env.DB_NAME || 'guardia_db');
            connection.release();
        } catch (error) {
            useMock = true;
            console.warn('⚠️  MySQL Server Not Reachable. Active Persistent Local DB Engine (guardia_db.json).');
        }
    }
})();

function mockExecute(sql, params = []) {
    const cleanSql = sql.trim();
    const upperSql = cleanSql.toUpperCase();

    // DDL Statements
    if (upperSql.startsWith('ALTER') || upperSql.startsWith('CREATE') || upperSql.startsWith('SET') || upperSql.startsWith('DROP')) {
        return Promise.resolve([[], []]);
    }

    // 1. SELECT STATEMENTS
    if (upperSql.startsWith('SELECT')) {
        // SELECT * FROM users WHERE email = ? or SELECT id FROM users WHERE email = ?
        if (cleanSql.includes('FROM users WHERE email = ?') || cleanSql.includes('FROM `users` WHERE email = ?') || cleanSql.includes('FROM `users` WHERE `email` = ?')) {
            const email = String(params[0] || '').trim().toLowerCase();
            const found = mockStore.users.filter(u => String(u.email || '').trim().toLowerCase() === email);
            return Promise.resolve([found, []]);
        }
        // SELECT * FROM users WHERE id = ?
        if (cleanSql.includes('FROM users WHERE id = ?') || cleanSql.includes('FROM `users` WHERE id = ?') || cleanSql.includes('FROM `users` WHERE `id` = ?')) {
            const id = parseInt(params[0]);
            const found = mockStore.users.filter(u => u.id === id);
            return Promise.resolve([found, []]);
        }
        // SELECT pin_code FROM users WHERE id = ?
        if (cleanSql.includes('pin_code') && cleanSql.includes('users WHERE id = ?')) {
            const id = parseInt(params[0]);
            const found = mockStore.users.filter(u => u.id === id).map(u => ({ pin_code: u.pin_code }));
            return Promise.resolve([found, []]);
        }
        // SELECT FROM doors
        if (cleanSql.includes('FROM doors') || cleanSql.includes('FROM `doors`')) {
            let found = mockStore.doors;
            if (cleanSql.includes('WHERE id = ? AND user_id = ?')) {
                const targetDoorId = parseInt(params[0]);
                const targetUserId = parseInt(params[1]);
                found = mockStore.doors.filter(d => d.id === targetDoorId && d.user_id === targetUserId);
            } else if (cleanSql.includes('WHERE user_id = ?')) {
                const targetUserId = parseInt(params[0]);
                found = mockStore.doors.filter(d => d.user_id === targetUserId);
            } else if (cleanSql.includes('WHERE id = ?')) {
                const targetDoorId = parseInt(params[0]);
                found = mockStore.doors.filter(d => d.id === targetDoorId);
            }

            if (found.length === 0 && (cleanSql.includes('user_id = ?') || cleanSql.includes('user_id='))) {
                const targetUserId = parseInt(params[params.length - 1]) || 1;
                const newDoor = {
                    id: nextIds.doors++,
                    user_id: targetUserId,
                    door_name: 'Main Door',
                    status: 'LOCKED',
                    security_mode: 'NORMAL',
                    power_status: 'AC',
                    battery_level: 100,
                    alarm_status: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                mockStore.doors.push(newDoor);
                saveStoreToDisk();
                found = [newDoor];
            }
            return Promise.resolve([found, []]);
        }
        // SELECT FROM access_credentials
        if (cleanSql.includes('FROM access_credentials') || cleanSql.includes('FROM `access_credentials`')) {
            const userId = parseInt(params[0]);
            const doorId = parseInt(params[1]);
            const method = params[2];

            let found = mockStore.access_credentials.filter(c => c.user_id === userId && c.door_id === doorId);
            if (method) {
                found = found.filter(c => c.method === method);
            }
            return Promise.resolve([found, []]);
        }
        // SELECT COUNT(*) FROM access_logs
        if (cleanSql.includes('COUNT(*)') && cleanSql.includes('access_logs')) {
            const userId = parseInt(params[0]);
            let filtered = mockStore.access_logs.filter(l => l.user_id === userId);

            if (cleanSql.includes("status IN ('granted', 'denied')")) {
                filtered = filtered.filter(l => l.status === 'granted' || l.status === 'denied');
            } else if (cleanSql.includes("status = 'granted'")) {
                filtered = filtered.filter(l => l.status === 'granted');
            } else if (cleanSql.includes("status = 'denied'")) {
                filtered = filtered.filter(l => l.status === 'denied');
            } else if (cleanSql.includes("status = 'system'")) {
                filtered = filtered.filter(l => l.status === 'system');
            } else {
                let pIndex = 1;
                if (cleanSql.includes('LOWER(access_method) = ?') && params[pIndex]) {
                    filtered = filtered.filter(l => (l.access_method || '').toLowerCase() === params[pIndex].toLowerCase());
                    pIndex++;
                }
                if (cleanSql.includes('status = ?') && params[pIndex]) {
                    filtered = filtered.filter(l => l.status === params[pIndex]);
                    pIndex++;
                }
            }

            return Promise.resolve([[{ count: filtered.length, COUNT: filtered.length }], []]);
        }

        // SELECT FROM access_logs
        if (cleanSql.includes('FROM access_logs') || cleanSql.includes('FROM `access_logs`')) {
            const userId = parseInt(params[0]);
            let filtered = mockStore.access_logs.filter(l => l.user_id === userId);
            let pIndex = 1;

            if (cleanSql.includes('LOWER(access_method) = ?') && params[pIndex]) {
                filtered = filtered.filter(l => (l.access_method || '').toLowerCase() === params[pIndex].toLowerCase());
                pIndex++;
            }
            if (cleanSql.includes('status = ?') && params[pIndex]) {
                filtered = filtered.filter(l => l.status === params[pIndex]);
                pIndex++;
            }

            filtered = [...filtered].sort((a, b) => (new Date(b.timestamp || 0)) - (new Date(a.timestamp || 0)));

            const limitMatch = cleanSql.match(/LIMIT\s+(\d+)/i);
            const offsetMatch = cleanSql.match(/OFFSET\s+(\d+)/i);
            if (limitMatch) {
                const limitVal = parseInt(limitMatch[1]);
                const offsetVal = offsetMatch ? parseInt(offsetMatch[1]) : 0;
                filtered = filtered.slice(offsetVal, offsetVal + limitVal);
            }

            return Promise.resolve([filtered, []]);
        }

        return Promise.resolve([[], []]);
    }

    // 2. INSERT STATEMENTS
    if (upperSql.startsWith('INSERT')) {
        // INSERT INTO users
        if (cleanSql.includes('INTO users') || cleanSql.includes('INTO `users`')) {
            const name = params[0];
            const email = String(params[1] || '').trim().toLowerCase();
            const passHash = params[2];
            const pinCode = params[3] || '1234';

            const newId = nextIds.users++;
            const newUser = { id: newId, name, email, password_hash: passHash, pin_code: pinCode, created_at: new Date().toISOString() };
            mockStore.users.push(newUser);
            saveStoreToDisk();

            return Promise.resolve([{ insertId: newId, affectedRows: 1 }, []]);
        }
        // INSERT INTO doors
        if (cleanSql.includes('INTO doors') || cleanSql.includes('INTO `doors`')) {
            const userId = params[0];
            const doorName = params[1] || 'Main Door';
            const status = params[2] || 'LOCKED';
            const secMode = params[3] || 'NORMAL';
            const powerStatus = params[4] || 'AC';
            const battLevel = params[5] || 100;
            const alarmStatus = params[6] || 0;

            const newId = nextIds.doors++;
            const newDoor = { id: newId, user_id: userId, door_name: doorName, status, security_mode: secMode, power_status: powerStatus, battery_level: battLevel, alarm_status: alarmStatus, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
            mockStore.doors.push(newDoor);
            saveStoreToDisk();
            return Promise.resolve([{ insertId: newId, affectedRows: 1 }, []]);
        }
        // INSERT INTO access_credentials
        if (cleanSql.includes('INTO access_credentials') || cleanSql.includes('INTO `access_credentials`')) {
            const userId = parseInt(params[0]);
            const doorId = parseInt(params[1]);
            const method = params[2];
            const hash = params[3];

            // Check if credential for method exists
            const existingCred = mockStore.access_credentials.find(c => c.user_id === userId && c.door_id === doorId && c.method === method && method === 'PIN');
            if (existingCred) {
                existingCred.credential_hash = hash;
                saveStoreToDisk();
                return Promise.resolve([{ insertId: existingCred.id, affectedRows: 1 }, []]);
            }

            const newId = nextIds.access_credentials++;
            const newCred = { id: newId, user_id: userId, door_id: doorId, method, credential_hash: hash, created_at: new Date().toISOString() };
            mockStore.access_credentials.push(newCred);
            saveStoreToDisk();
            return Promise.resolve([{ insertId: newId, affectedRows: 1 }, []]);
        }
        // INSERT INTO access_logs
        if (cleanSql.includes('INTO access_logs') || cleanSql.includes('INTO `access_logs`')) {
            const userId = parseInt(params[0]);
            const doorId = parseInt(params[1]);
            const accessMethod = params[2];
            const status = params[3];
            const description = params[4];

            const newId = nextIds.access_logs++;
            const newLog = { id: newId, user_id: userId, door_id: doorId, access_method: accessMethod, status, description, timestamp: new Date().toISOString() };
            mockStore.access_logs.push(newLog);
            saveStoreToDisk();
            return Promise.resolve([{ insertId: newId, affectedRows: 1 }, []]);
        }
    }

    // 3. UPDATE STATEMENTS
    if (upperSql.startsWith('UPDATE')) {
        // UPDATE doors SET ...
        if (cleanSql.includes('UPDATE doors') || cleanSql.includes('UPDATE `doors`')) {
            let targetDoorId = null;
            let targetUserId = null;

            if (cleanSql.includes('WHERE id = ? AND user_id = ?')) {
                targetDoorId = parseInt(params[1]);
                targetUserId = parseInt(params[2]);
            } else if (cleanSql.includes('WHERE id = ?')) {
                targetDoorId = parseInt(params[params.length - 1]);
            } else if (cleanSql.includes('WHERE user_id = ?')) {
                targetUserId = parseInt(params[params.length - 1]);
            }

            let door = mockStore.doors.find(d => 
                (targetDoorId && d.id === targetDoorId) || 
                (targetUserId && d.user_id === targetUserId)
            ) || mockStore.doors[0];

            if (cleanSql.includes('security_mode = ?, status = ?, alarm_status = 1')) {
                if (door) {
                    door.security_mode = params[0];
                    door.status = params[1];
                    door.alarm_status = 1;
                }
            } else if (cleanSql.includes('security_mode = ?, alarm_status = 0')) {
                if (door) {
                    door.security_mode = params[0];
                    door.alarm_status = 0;
                }
            } else if (cleanSql.includes('status = ?')) {
                if (door) door.status = params[0];
            } else if (cleanSql.includes('alarm_status = 1')) {
                if (door) door.alarm_status = 1;
            } else if (cleanSql.includes('alarm_status = 0')) {
                if (door) door.alarm_status = 0;
            } else if (cleanSql.includes('alarm_status = ?')) {
                if (door) door.alarm_status = parseInt(params[0]);
            } else if (cleanSql.includes('security_mode = ?')) {
                if (door) door.security_mode = params[0];
            } else if (cleanSql.includes('power_status = ?')) {
                if (door) door.power_status = params[0];
            }
            saveStoreToDisk();
            return Promise.resolve([{ affectedRows: 1 }, []]);
        }
        // UPDATE users SET pin_code = ?
        if (cleanSql.includes('UPDATE users SET pin_code = ?') || cleanSql.includes('UPDATE `users` SET `pin_code` = ?')) {
            const newPin = params[0];
            const userId = parseInt(params[1]);
            const user = mockStore.users.find(u => u.id === userId);
            if (user) user.pin_code = newPin;
            saveStoreToDisk();
            return Promise.resolve([{ affectedRows: 1 }, []]);
        }
    }

    // 4. DELETE STATEMENTS
    if (upperSql.startsWith('DELETE')) {
        if (cleanSql.includes('FROM access_logs') || cleanSql.includes('FROM `access_logs`')) {
            const userId = parseInt(params[0]);
            mockStore.access_logs = mockStore.access_logs.filter(l => l.user_id !== userId);
            saveStoreToDisk();
            return Promise.resolve([{ affectedRows: 1 }, []]);
        }
        if (cleanSql.includes('FROM access_credentials WHERE id = ?')) {
            const credId = parseInt(params[0]);
            mockStore.access_credentials = mockStore.access_credentials.filter(c => c.id !== credId);
            saveStoreToDisk();
            return Promise.resolve([{ affectedRows: 1 }, []]);
        }
    }

    return Promise.resolve([[], []]);
}

module.exports = {
    execute: (sql, params) => {
        if (useMock || !pool) {
            return mockExecute(sql, params);
        }
        return pool.execute(sql, params).catch(err => {
            console.warn('⚠️  MySQL query error. Active Persistent Local DB Engine (guardia_db.json):', err.message);
            useMock = true;
            return mockExecute(sql, params);
        });
    },
    query: (sql, params) => {
        if (useMock || !pool) {
            return mockExecute(sql, params);
        }
        return pool.query(sql, params).catch(err => {
            useMock = true;
            return mockExecute(sql, params);
        });
    },
    getConnection: async () => {
        if (useMock || !pool) {
            return {
                execute: mockExecute,
                release: () => {}
            };
        }
        return pool.getConnection();
    }
};
