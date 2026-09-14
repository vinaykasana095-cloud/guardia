const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'guardia_cyber_secret_key_2026_v25';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 1. REGISTER USER
exports.register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // Validation 1: Required fields
        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required (Name, Email, Password, Confirm Password).' });
        }

        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();

        // Validation 2: Email format
        if (!EMAIL_REGEX.test(cleanEmail)) {
            return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }

        // Validation 3: Password minimum length
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
        }

        // Validation 4: Password match
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Password and Confirm Password do not match.' });
        }

        // Validation 5: Prevent Duplicate Email Registration
        const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }

        // Hash Password with bcrypt
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert User into MySQL
        const [userResult] = await db.execute(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [cleanName, cleanEmail, passwordHash]
        );

        const userId = userResult.insertId;

        // Initialize User's isolated Smart Door record
        const [doorResult] = await db.execute(
            'INSERT INTO doors (user_id, door_name, status, security_mode, power_status, battery_level, alarm_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, `${cleanName}'s Smart Door`, 'LOCKED', 'NORMAL', 'AC', 100, 0]
        );

        const doorId = doorResult.insertId;

        // Initial PIN credential
        const defaultPinHash = await bcrypt.hash('1234', 10);
        await db.execute(
            'INSERT INTO access_credentials (user_id, door_id, method, credential_hash) VALUES (?, ?, ?, ?)',
            [userId, doorId, 'PIN', defaultPinHash]
        );

        // Initial system audit log
        await db.execute(
            'INSERT INTO access_logs (user_id, door_id, access_method, status, description) VALUES (?, ?, ?, ?, ?)',
            [userId, doorId, 'System Init', 'system', `Account registered & Smart Door initialized for ${cleanName}`]
        );

        console.log(`✅ User registered successfully in database: ${cleanEmail} (ID: ${userId})`);

        // Generate 24h JWT token
        const token = jwt.sign({ userId, email: cleanEmail, name: cleanName }, JWT_SECRET, { expiresIn: '24h' });

        return res.status(201).json({
            success: true,
            message: 'User account registered successfully.',
            token,
            user: { id: userId, name: cleanName, email: cleanEmail }
        });

    } catch (error) {
        console.error('Registration Error:', error);
        return res.status(500).json({ success: false, message: 'Server error during registration.' });
    }
};

// 2. LOGIN USER
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide both Email and Password.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        console.log(`🔐 Login attempt for: ${cleanEmail}`);

        // Parameterized Query to prevent SQL Injection
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [cleanEmail]);

        // Generic error message for security (Do not reveal if email or password specifically failed)
        const GENERIC_AUTH_ERROR = 'Invalid email or password.';

        if (users.length === 0) {
            console.warn(`❌ Login failed: User '${cleanEmail}' not found in database.`);
            return res.status(401).json({ success: false, message: GENERIC_AUTH_ERROR });
        }

        const user = users[0];

        // Bcrypt Password Verification (with flexible handling for trimming and casing)
        let isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch && typeof password === 'string') {
            if (password.trim() !== password) {
                isMatch = await bcrypt.compare(password.trim(), user.password_hash);
            }
            if (!isMatch) {
                isMatch = await bcrypt.compare(password.toLowerCase(), user.password_hash);
            }
            if (!isMatch) {
                const cap = password.charAt(0).toUpperCase() + password.slice(1);
                isMatch = await bcrypt.compare(cap, user.password_hash);
            }
        }

        if (!isMatch) {
            console.warn(`❌ Password mismatch for user: ${cleanEmail}`);
            return res.status(401).json({ success: false, message: GENERIC_AUTH_ERROR });
        }

        // Generate 24h JWT Token
        const token = jwt.sign(
            { userId: user.id, email: user.email, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log(`✅ Login successful for user: ${cleanEmail} (ID: ${user.id})`);

        // Return token and SAFE user info (EXPLICITLY NO password_hash!)
        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
};

// 3. GET CURRENT AUTHENTICATED USER
exports.getMe = async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User profile not found.' });
        }
        return res.status(200).json({ success: true, user: users[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to retrieve user profile.' });
    }
};
