const express = require('express');
const router = express.Router();
const rfidController = require('../controllers/rfidController');
const verifyToken = require('../middleware/authMiddleware');

/**
 * RFID ACCESS & MANAGEMENT ENDPOINTS
 */
router.post('/verify', verifyToken, rfidController.verifyRfid);
router.get('/cards', verifyToken, rfidController.getUserCards);
router.post('/cards', verifyToken, rfidController.addCard);
router.delete('/cards/:id', verifyToken, rfidController.deleteCard);

module.exports = router;
