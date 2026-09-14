const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/summary', dashboardController.getDashboardSummary);
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;
