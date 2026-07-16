const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');

const getTechnicians = asyncHandler(async (req, res) => {
  const technicians = await User.find({ role: 'technician', isActive: true }).select('name email role expertise createdAt');
  res.json({ technicians });
});

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ isActive: true }).select('name email role createdAt');
  res.json({ users });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, expertise } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
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

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // Admin created OTP expires in 24h

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    expertise: Array.isArray(expertise) ? expertise : [],
    isActive: true,
    isVerified: false,
    verificationCode: otp,
    verificationCodeExpires: otpExpires,
  });

  const { sendEmail } = require('../services/emailService');
  sendEmail({
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
  }).catch((err) => console.error('Failed to send admin onboard verification email:', err.message));

  res.status(201).json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      expertise: user.expertise,
    },
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, department, twoFactorEnabled } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone.trim();
  if (department !== undefined) user.department = department.trim();
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

module.exports = { getTechnicians, getUsers, createUser, updateProfile, changePassword };
