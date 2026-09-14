const express = require('express');
const router = express.Router();
const pinController = require('../controllers/pinController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/verify', pinController.verifyPin);
router.post('/set', pinController.changePin);
router.post('/change', pinController.changePin);

module.exports = router;
