const express = require('express');
const {
  getTechnicians,
  getUsers,
  getPendingUsers,
  decideApproval,
  setSupervisorCategories,
  setUserActive,
  deleteUser,
  createUser,
  updateProfile,
  changePassword,
} = require('../controllers/userController');
const { protect, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Technicians can see the team directory too (grouped by expertise on the frontend).
router.get('/technicians', protect, authorizeRoles('admin', 'technician'), getTechnicians);
router.get('/', protect, authorizeRoles('admin'), getUsers);
router.get('/pending', protect, authorizeRoles('admin'), getPendingUsers);
router.patch('/:id/approval', protect, authorizeRoles('admin'), decideApproval);
router.patch('/:id/supervisor', protect, authorizeRoles('admin'), setSupervisorCategories);
router.patch('/:id/active', protect, authorizeRoles('admin'), setUserActive);
router.delete('/:id', protect, authorizeRoles('admin'), deleteUser);
router.post('/', protect, authorizeRoles('admin'), createUser);
router.patch('/profile', protect, updateProfile);
router.patch('/change-password', protect, changePassword);

module.exports = router;
