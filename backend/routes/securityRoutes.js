const express = require('express');
const router = express.Router();
const securityController = require('../controllers/securityController');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// 1. Alarm Endpoints
router.post('/alarm/activate', securityController.activateAlarm);
router.post('/alarm/deactivate', securityController.deactivateAlarm);
router.post('/alarm', securityController.toggleAlarm);

// 2. Emergency Mode Endpoints
router.post('/emergency/activate', securityController.activateEmergency);
router.post('/emergency/deactivate', securityController.deactivateEmergency);
router.post('/emergency', securityController.toggleEmergency);

// 3. Privacy Mode Endpoints
router.post('/privacy/enable', securityController.enablePrivacy);
router.post('/privacy/disable', securityController.disablePrivacy);
router.post('/privacy', securityController.togglePrivacy);

// 4. Power Backup Simulation Endpoints
router.post('/power/failure', securityController.simulatePowerFailure);
router.post('/power/restore', securityController.restoreMainPower);
// 5. Security Status Overview Endpoint
router.get('/status', securityController.getSecurityStatus);

module.exports = router;
