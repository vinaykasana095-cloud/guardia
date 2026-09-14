const express = require('express');
const router = express.Router();
const fingerprintController = require('../controllers/fingerprintController');
const verifyToken = require('../middleware/authMiddleware');

/**
 * POST /api/access/fingerprint/verify
 * Verifies simulated fingerprint biometric credential for authenticated user
 */
router.post('/verify', verifyToken, fingerprintController.verifyFingerprint);

module.exports = router;
