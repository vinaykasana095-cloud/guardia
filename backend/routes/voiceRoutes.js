const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/log', voiceController.logVoiceAttempt);

module.exports = router;
