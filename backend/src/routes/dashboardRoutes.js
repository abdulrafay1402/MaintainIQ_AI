const express = require('express');
const { getAdminDashboard, getStudentDashboard, getTechnicianDashboard } = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', protect, authorizeRoles('admin'), getAdminDashboard);
router.get('/student', protect, getStudentDashboard);
router.get('/technician', protect, authorizeRoles('technician', 'admin'), getTechnicianDashboard);

module.exports = router;
