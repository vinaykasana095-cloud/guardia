const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import Routes
const authRoutes = require('./routes/authRoutes');
const doorRoutes = require('./routes/doorRoutes');
const accessRoutes = require('./routes/accessRoutes');
const pinRoutes = require('./routes/pinRoutes');
const fingerprintRoutes = require('./routes/fingerprintRoutes');
const rfidRoutes = require('./routes/rfidRoutes');
const securityRoutes = require('./routes/securityRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/door', doorRoutes);
app.use('/api/access/pin', pinRoutes);
app.use('/api/access/fingerprint', fingerprintRoutes);
app.use('/api/access/rfid', rfidRoutes);
app.use('/api/access/voice', voiceRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/security', securityRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'GUARDIA Backend Server Active', timestamp: new Date() });
});

// Fallback 404 handler for API
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API Endpoint Not Found' });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('🔥 Global Server Error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🛡️  GUARDIA REST API Server running on port ${PORT}`);
    console.log(`🌐 Base URL: http://localhost:${PORT}/api`);
    console.log(`=======================================================`);
});
