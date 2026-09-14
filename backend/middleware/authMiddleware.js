const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            unauthenticated: true,
            message: 'Access Denied: Unauthenticated request. Missing Bearer token.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const secret = process.env.JWT_SECRET || 'guardia_cyber_secret_key_2026_v25';
        const decoded = jwt.verify(token, secret);
        req.user = decoded; // { userId, email, name }
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            unauthenticated: true,
            message: 'Session expired or invalid token. Please log in again.'
        });
    }
};

module.exports = verifyToken;
