const bcrypt = require('bcryptjs');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const generateToken = require('../utils/generateToken');
const { sendEmail } = require('../services/emailService');
const { isValidEmail, OTP_TTL_MS } = require('../utils/validators');
const { notifyAdmins } = require('../services/notificationService');

const PUBLIC_ROLES = ['student', 'technician'];
const EXPERTISE_OPTIONS = ['Electronics / IT', 'Electrical', 'HVAC / Air Conditioning', 'Plumbing', 'Mechanical / Furniture', 'Safety & Security', 'Lab Equipment'];

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

// OTP emails must be awaited before responding: on serverless (Vercel) the function
// freezes as soon as the response is sent, so fire-and-forget emails are silently lost.
const sendEmailAwaited = async (payload) => {
  try {
    return await sendEmail(payload);
  } catch (error) {
    console.error('Email send failed:', error.message);
    return false;
  }
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, expertise, studentId } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  if (!isValidEmail(email)) {
    throw new ApiError(400, 'Please provide a valid email address');
  }

  if (password.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  // Public sign-up creates student (reporter) or technician accounts.
  // Admin accounts are only ever created by another admin from the Staff page.
  const userRole = role || 'student';
  if (!PUBLIC_ROLES.includes(userRole)) {
    throw new ApiError(403, 'Public registration is only allowed for Student or Technician accounts. Admin accounts are created by an administrator.');
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'Email already registered');
  }

  if (userRole === 'student') {
    if (!studentId || !String(studentId).trim()) {
      throw new ApiError(400, 'Student ID is required');
    }
    const existingStudentId = await User.findOne({ studentId, role: 'student' });
    if (existingStudentId) {
      throw new ApiError(400, 'Student ID already registered');
    }
  }

  const cleanExpertise = userRole === 'technician' && Array.isArray(expertise)
    ? expertise.filter((tag) => EXPERTISE_OPTIONS.includes(tag))
    : [];

  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: userRole,
    studentId: userRole === 'student' ? studentId : undefined,
    expertise: cleanExpertise,
    isVerified: false,
    // Self-registered accounts must be approved by an admin before they can
    // access the panel; admin-onboarded accounts skip this gate.
    approvalStatus: 'pending',
    // Students get 2FA on by default (they can turn it off from Settings).
    twoFactorEnabled: userRole === 'student',
    verificationCode: otp,
    verificationCodeExpires: otpExpires,
  });

  const emailSent = await sendEmailAwaited({
    to: user.email,
    subject: 'MaintainIQ Verification Code',
    text: `Hello ${user.name},\n\nYour verification code is: ${otp}\n\nThis code expires in 1 minute.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Verify Your MaintainIQ Account</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">Thank you for registering. Please use the following verification code to complete your sign-up:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </div>
        <p style="color: #815355; font-size: 14px; text-align: center;">This code will expire in 1 minute.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  });

  res.status(201).json({
    message: emailSent
      ? 'Verification code sent to email (check spam folder too — it expires in 1 minute)'
      : 'Account created, but the verification email could not be sent. Use "Resend code" to try again.',
    status: 'verification_pending',
    emailSent,
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

  if (user.approvalStatus === 'rejected') {
    throw new ApiError(403, 'Your signup request was rejected by the administrator. Contact support if you believe this is a mistake.');
  }

  // Self-registered accounts stay locked out until an admin approves them.
  // (Email verification still runs first so the address is confirmed.)
  if (user.isVerified && user.approvalStatus === 'pending') {
    return res.status(200).json({
      message: 'Your request is in progress and needs approval by the admin.',
      status: 'approval_pending',
      email: user.email,
    });
  }

  if (user.isVerified && !user.twoFactorEnabled) {
    const token = generateToken({ id: user._id, role: user.role, name: user.name, email: user.email });

    res.cookie('token', token, cookieOptions);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  user.verificationCode = otp;
  user.verificationCodeExpires = otpExpires;
  await user.save();

  const emailSent = await sendEmailAwaited({
    to: user.email,
    subject: 'MaintainIQ Verification Code',
    text: `Hello ${user.name},\n\nYour verification code is: ${otp}\n\nThis code expires in 1 minute.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Verify Your MaintainIQ Account</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">Please use the following verification code to complete your login:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </div>
        <p style="color: #815355; font-size: 14px; text-align: center;">This code will expire in 1 minute.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  });

  return res.status(200).json({
    message: emailSent
      ? 'Verification code sent to email (check spam folder too — it expires in 1 minute)'
      : 'Could not send the verification email. Use "Resend code" to try again.',
    status: 'verification_pending',
    emailSent,
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

  // Verified but not yet approved: no token is issued. Admins are notified
  // so they can accept/reject the request from the Staff page.
  if (user.approvalStatus === 'pending') {
    try {
      await notifyAdmins({
        type: 'signup_request',
        title: `New ${user.role} signup awaiting approval`,
        message: `${user.name} (${user.email}) verified their email and is waiting for account approval.`,
      });
    } catch (error) {
      console.error('Failed to notify admins about signup:', error.message);
    }

    return res.status(200).json({
      message: 'Email verified. Your request is in progress and needs approval by the admin.',
      status: 'approval_pending',
      email: user.email,
    });
  }

  const token = generateToken({ id: user._id, role: user.role, name: user.name, email: user.email });

  await sendEmailAwaited({
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
  });

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

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isVerified && !user.twoFactorEnabled) {
    throw new ApiError(400, 'User is already verified and does not have 2FA enabled');
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + OTP_TTL_MS);

  user.verificationCode = otp;
  user.verificationCodeExpires = otpExpires;
  await user.save();

  const emailSent = await sendEmailAwaited({
    to: user.email,
    subject: 'MaintainIQ Verification Code',
    text: `Hello ${user.name},\n\nYour verification code is: ${otp}\n\nThis code expires in 1 minute.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Verify Your MaintainIQ Account</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">Please use the following verification code to complete your verification:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${otp}
        </div>
        <p style="color: #815355; font-size: 14px; text-align: center;">This code will expire in 1 minute.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  });

  if (!emailSent) {
    throw new ApiError(502, 'Could not send the verification email. Please try again in a moment.');
  }

  res.status(200).json({
    message: 'Verification code resent successfully (check spam folder too)',
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  user.resetPasswordCode = code;
  user.resetPasswordExpires = expires;
  await user.save();

  const emailSent = await sendEmailAwaited({
    to: user.email,
    subject: 'MaintainIQ Password Reset Code',
    text: `Hello ${user.name},\n\nYour password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nBest regards,\nMaintainIQ Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ECF8FD;">
        <h2 style="color: #272838; text-align: center;">Reset Your MaintainIQ Password</h2>
        <p style="color: #272838; font-size: 16px;">Hello ${user.name},</p>
        <p style="color: #272838; font-size: 16px;">You requested a password reset. Please use the following code to reset your password:</p>
        <div style="background-color: #272838; color: #F2B418; font-size: 32px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; letter-spacing: 5px;">
          ${code}
        </div>
        <p style="color: #815355; font-size: 14px; text-align: center;">This code will expire in 15 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #AFCBD5; margin: 20px 0;">
        <p style="color: #5F7F8C; font-size: 12px; text-align: center;">© 2026 MaintainIQ. All rights reserved.</p>
      </div>
    `,
  });

  if (!emailSent) {
    throw new ApiError(502, 'Could not send the password reset email. Please try again in a moment.');
  }

  res.json({ message: 'Password reset code sent to email (check spam folder too)' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    throw new ApiError(400, 'Email, code, and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.resetPasswordCode !== code) {
    throw new ApiError(400, 'Invalid reset code');
  }

  if (new Date() > user.resetPasswordExpires) {
    throw new ApiError(400, 'Reset code has expired');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetPasswordCode = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: 'Password reset successful' });
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
      twoFactorEnabled: req.user.twoFactorEnabled,
      department: req.user.department,
      phone: req.user.phone,
      studentId: req.user.studentId,
      expertise: req.user.expertise,
      supervisorCategories: req.user.supervisorCategories || [],
    },
  });
});

module.exports = { register, login, logout, me, verifyOtp, resendOtp, forgotPassword, resetPassword };
