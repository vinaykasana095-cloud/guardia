const express = require('express');
const router = express.Router();
const doorController = require('../controllers/doorController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', doorController.getDoorStatus);
router.post('/unlock', doorController.unlockDoor);
router.post('/lock', doorController.lockDoor);
router.post('/open', doorController.openDoor);
router.post('/close', doorController.closeDoor);

module.exports = router;
