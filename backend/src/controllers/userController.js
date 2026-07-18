const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { sendEmail } = require('../services/emailService');
const { isValidEmail, isValidPhone } = require('../utils/validators');
const { notifyUser } = require('../services/notificationService');

const EXPERTISE_OPTIONS = ['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'];

// Technicians can see each other (team directory); admins see everything.
// NOTE: pre-existing documents have no approvalStatus field, so the filter must
// use $nin (missing field = approved) instead of matching 'approved' directly.
const getTechnicians = asyncHandler(async (req, res) => {
  const technicians = await User.find({ role: 'technician', isActive: true, approvalStatus: { $nin: ['pending', 'rejected'] } })
    .select('name email role expertise supervisorCategories department createdAt');
  res.json({ technicians });
});

const getUsers = asyncHandler(async (req, res) => {
  // Deactivated accounts stay visible (flagged) so the admin can reactivate them.
  const users = await User.find({ approvalStatus: { $nin: ['pending', 'rejected'] } })
    .select('name email role expertise supervisorCategories studentId department phone isActive createdAt');
  res.json({ users });
});

// Guards shared by deactivate/delete: admins can only manage technician and
// student accounts, and can never act on themselves or another admin.
const getManagedUser = async (req) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot perform this action on your own account');
  }
  if (user.role === 'admin') {
    throw new ApiError(403, 'Admin accounts cannot be removed from here');
  }
  return user;
};

const setUserActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    throw new ApiError(400, 'isActive must be true or false');
  }

  const user = await getManagedUser(req);
  user.isActive = isActive;
  await user.save();

  sendEmail({
    to: user.email,
    subject: isActive ? 'MaintainIQ — Account Reactivated' : 'MaintainIQ — Account Deactivated',
    text: isActive
      ? `Hello ${user.name},\n\nYour MaintainIQ account has been reactivated by the administrator. You can log in again.\n\nBest regards,\nMaintainIQ Team`
      : `Hello ${user.name},\n\nYour MaintainIQ account has been deactivated by the administrator. Contact support if you believe this is a mistake.\n\nBest regards,\nMaintainIQ Team`,
  }).catch((err) => console.error('Active-status email failed:', err.message));

  res.json({
    message: isActive ? `${user.name} account reactivated` : `${user.name} account deactivated`,
    user: { id: user._id, name: user.name, isActive: user.isActive },
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await getManagedUser(req);

  // Clean up references so nothing dangles:
  // active work goes back to the shared pool, assets lose the default technician,
  // and the account's notifications are removed. Settled issues and history keep
  // their recorded names, so the audit trail stays intact.
  const Issue = require('../models/Issue');
  const Asset = require('../models/Asset');
  const Notification = require('../models/Notification');
  const SETTLED = ['Resolved', 'Verified', 'Closed', 'Rejected', 'Cancelled'];

  if (user.role === 'technician') {
    await Issue.updateMany(
      { assignedTechnician: user._id, status: { $nin: SETTLED } },
      { $set: { assignedTechnician: null } }
    );
    await Asset.updateMany({ assignedTechnician: user._id }, { $set: { assignedTechnician: null } });
  }
  await Notification.deleteMany({ user: user._id });

  await User.deleteOne({ _id: user._id });

  res.json({ message: `${user.name} (${user.role}) permanently deleted` });
});

// Self-registered accounts waiting for an admin decision.
const getPendingUsers = asyncHandler(async (req, res) => {
  const pending = await User.find({ approvalStatus: 'pending' })
    .select('name email role expertise studentId isVerified createdAt')
    .sort({ createdAt: -1 });
  res.json({ pending });
});

const decideApproval = asyncHandler(async (req, res) => {
  const { action } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    throw new ApiError(400, 'Action must be "approve" or "reject"');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.approvalStatus !== 'pending') {
    throw new ApiError(400, `This account is already ${user.approvalStatus}`);
  }

  user.approvalStatus = action === 'approve' ? 'approved' : 'rejected';
  await user.save();

  sendEmail({
    to: user.email,
    subject: action === 'approve' ? 'MaintainIQ — Account Approved' : 'MaintainIQ — Account Request Update',
    text: action === 'approve'
      ? `Hello ${user.name},\n\nYour MaintainIQ ${user.role} account has been approved by the administrator. You can now log in.\n\nBest regards,\nMaintainIQ Team`
      : `Hello ${user.name},\n\nUnfortunately your MaintainIQ signup request was not approved at this time.\n\nBest regards,\nMaintainIQ Team`,
  }).catch((err) => console.error('Approval email failed:', err.message));

  res.json({
    message: action === 'approve' ? 'Account approved' : 'Account rejected',
    user: { id: user._id, name: user.name, email: user.email, role: user.role, approvalStatus: user.approvalStatus },
  });
});

// Admin promotes/demotes a technician to supervisor of one or more categories.
const setSupervisorCategories = asyncHandler(async (req, res) => {
  const { categories } = req.body;

  if (!Array.isArray(categories)) {
    throw new ApiError(400, 'categories must be an array');
  }

  const clean = categories.filter((c) => EXPERTISE_OPTIONS.includes(c));
  if (clean.length !== categories.length) {
    throw new ApiError(400, 'One or more categories are invalid');
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  if (user.role !== 'technician') {
    throw new ApiError(400, 'Only technicians can be made supervisors');
  }

  user.supervisorCategories = clean;
  await user.save();

  try {
    await notifyUser({
      userId: user._id,
      type: 'supervisor_update',
      title: clean.length ? 'You are now a supervisor' : 'Supervisor role removed',
      message: clean.length
        ? `You are now the supervisor for: ${clean.join(', ')}. You can verify, close, and reopen resolved work in these departments.`
        : 'Your supervisor rights have been removed by the administrator.',
    });
  } catch (error) {
    console.error('Supervisor notification failed:', error.message);
  }

  res.json({
    message: 'Supervisor categories updated',
    user: { id: user._id, name: user.name, supervisorCategories: user.supervisorCategories },
  });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, expertise, supervisorCategories } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  if (!['admin', 'technician'].includes(role)) {
    throw new ApiError(400, 'Only admin or technician accounts can be created through this endpoint');
  }

  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'Email already registered');
  }

  const cleanExpertise = role === 'technician' && Array.isArray(expertise)
    ? expertise.filter((tag) => EXPERTISE_OPTIONS.includes(tag))
    : [];
  const cleanSupervisor = role === 'technician' && Array.isArray(supervisorCategories)
    ? supervisorCategories.filter((tag) => EXPERTISE_OPTIONS.includes(tag))
    : [];

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Admin created OTP expires in 24h

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    expertise: cleanExpertise,
    supervisorCategories: cleanSupervisor,
    isActive: true,
    isVerified: false,
    // Admin-onboarded accounts do not go through the approval queue.
    approvalStatus: 'approved',
    verificationCode: otp,
    verificationCodeExpires: otpExpires,
  });

  // Awaited so the credentials email isn't lost when the serverless function freezes after responding.
  const emailSent = await sendEmail({
    to: user.email,
    subject: 'MaintainIQ Account Created',
    text: `Hello ${user.name},\n\nAn administrator has created your MaintainIQ ${role} account. Here are your credentials:\n\nEmail: ${user.email}\nPassword: ${password}\n\nYour 2-Factor verification code is: ${otp}\n\nPlease enter this code on your first login.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">MaintainIQ Account Created</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">An administrator has created your MaintainIQ <strong>${role}</strong> account. Here are your credentials:</p>
        <div style="background-color: #272838; color: #ECF8FD; padding: 15px; border-radius: 8px; font-size: 16px; margin: 20px 0;">
          <strong>Email:</strong> ${user.email}<br/>
          <strong>Password:</strong> ${password}
        </div>
        <p style="color: #272838; font-size: 16px;">To verify and activate your account, please use the following verification code during login:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </div>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  }).catch((err) => {
    console.error('Failed to send admin onboard verification email:', err.message);
    return false;
  });

  res.status(201).json({
    emailSent: !!emailSent,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      expertise: user.expertise,
      supervisorCategories: user.supervisorCategories,
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, department, twoFactorEnabled } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (phone !== undefined && String(phone).trim() && !isValidPhone(String(phone))) {
    throw new ApiError(400, 'Phone must be 12 digits starting with 92 (e.g. 923001234567) or 11 digits starting with 0 (e.g. 03001234567)');
  }

  if (name) user.name = String(name).trim();
  if (phone !== undefined) user.phone = String(phone).trim();
  if (department !== undefined) user.department = String(department).trim();
  if (twoFactorEnabled !== undefined) user.twoFactorEnabled = !!twoFactorEnabled;

  await user.save();

  res.json({
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      department: user.department,
      twoFactorEnabled: user.twoFactorEnabled,
      studentId: user.studentId,
      expertise: user.expertise,
      supervisorCategories: user.supervisorCategories,
    },
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) {
    throw new ApiError(401, 'Incorrect current password');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  res.json({ message: 'Password updated successfully' });
});

module.exports = {
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
};
