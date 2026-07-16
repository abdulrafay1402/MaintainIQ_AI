const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const generateToken = require('../utils/generateToken');
const { sendEmail } = require('../services/emailService');

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, expertise } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  if (role && !['student', 'technician'].includes(role)) {
    throw new ApiError(403, 'Public registration is only allowed for Student or Technician roles');
  }

  const userRole = role || 'student';

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'Email already registered');
  }

  const { studentId } = req.body;
  if (userRole === 'student' && studentId) {
    const existingStudentId = await User.findOne({ studentId, role: 'student' });
    if (existingStudentId) {
      throw new ApiError(400, 'Student ID already registered');
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: userRole,
    expertise: userRole === 'technician' && Array.isArray(expertise) ? expertise : [],
    studentId: userRole === 'student' ? studentId : undefined,
    isVerified: false,
    verificationCode: otp,
    verificationCodeExpires: otpExpires,
  });

  sendEmail({
    to: user.email,
    subject: 'MaintainIQ Verification Code',
    text: `Hello ${user.name},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Verify Your MaintainIQ Account</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">Thank you for registering. Please use the following verification code to complete your sign-up:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </div>
        <p style="color: #815355; font-size: 14px; text-align: center;">This code will expire in 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  }).catch((err) => console.error('Failed to send verification email:', err.message));

  res.status(201).json({
    message: 'Verification code sent to email',
    status: 'verification_pending',
    email: user.email,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.verificationCode = otp;
  user.verificationCodeExpires = otpExpires;
  await user.save();

  sendEmail({
    to: user.email,
    subject: 'MaintainIQ Verification Code',
    text: `Hello ${user.name},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Verify Your MaintainIQ Account</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">Please use the following verification code to complete your login:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </div>
        <p style="color: #815355; font-size: 14px; text-align: center;">This code will expire in 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  }).catch((err) => console.error('Failed to send login verification email:', err.message));

  return res.status(200).json({
    message: 'Email verification pending',
    status: 'verification_pending',
    email: user.email,
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    throw new ApiError(400, 'Email and code are required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.verificationCode !== code) {
    throw new ApiError(400, 'Invalid verification code');
  }

  if (new Date() > user.verificationCodeExpires) {
    throw new ApiError(400, 'Verification code has expired');
  }

  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  const token = generateToken({ id: user._id, role: user.role, name: user.name, email: user.email });

  sendEmail({
    to: user.email,
    subject: 'Welcome to MaintainIQ',
    text: `Hello ${user.name},\n\nYour account has been successfully verified. You can now use MaintainIQ to scan assets, log faults, and track technician operations.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Welcome to MaintainIQ</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">Your account has been successfully verified! You can now scan assets, log faults, and track technician operations in the MaintainIQ Workspace.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  }).catch((err) => console.error('Failed to send welcome email:', err.message));

  res.cookie('token', token, cookieOptions);
  res.status(200).json({
    message: 'Email verified successfully',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified) {
    throw new ApiError(400, 'User is already verified');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  user.verificationCode = otp;
  user.verificationCodeExpires = otpExpires;
  await user.save();

  sendEmail({
    to: user.email,
    subject: 'MaintainIQ Verification Code',
    text: `Hello ${user.name},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Verify Your MaintainIQ Account</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">Please use the following verification code to complete your verification:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </div>
        <p style="color: #815355; font-size: 14px; text-align: center;">This code will expire in 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  }).catch((err) => console.error('Failed to send resend email:', err.message));

  res.status(200).json({
    message: 'Verification code resent successfully',
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', cookieOptions);
  res.json({ message: 'Logged out' });
});

const me = asyncHandler(async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = { register, login, logout, me, verifyOtp, resendOtp };
