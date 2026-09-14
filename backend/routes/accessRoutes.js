const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/verify', accessController.verifyAccess);
router.get('/history', accessController.getAccessHistory);
router.delete('/history', accessController.clearAccessHistory);

module.exports = router;
