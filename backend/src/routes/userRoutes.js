const express = require('express');
const { getTechnicians, getUsers, createUser, updateProfile, changePassword } = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/technicians', protect, authorizeRoles('admin'), getTechnicians);
router.get('/', protect, authorizeRoles('admin'), getUsers);
router.post('/', protect, authorizeRoles('admin'), createUser);
router.patch('/profile', protect, updateProfile);
router.patch('/change-password', protect, changePassword);

module.exports = router;
