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

  const userRole = 'student';

  if (role && role !== 'student') {
    throw new ApiError(403, 'Public registration is limited to student accounts');
  }

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
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: userRole,
    expertise: Array.isArray(expertise) ? expertise : [],
    studentId: userRole === 'student' ? studentId : undefined,
  });

  const token = generateToken({ id: user._id, role: user.role, name: user.name, email: user.email });

  sendEmail({
    to: user.email,
    subject: 'Welcome to MaintainIQ! 🎉',
    text: `Hello ${user.name},\n\nYour account has been successfully created. You can now use MaintainIQ to scan assets, log faults, and track technician operations.\n\nBest regards,\nMaintainIQ Team`,
  }).catch((err) => console.error('Failed to send welcome email:', err.message));

  res.cookie('token', token, cookieOptions);
  res.status(201).json({
    message: 'User registered',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
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

  const token = generateToken({ id: user._id, role: user.role, name: user.name, email: user.email });

  sendEmail({
    to: user.email,
    subject: 'Security Alert: New Login Detected 🔐',
    text: `Hello ${user.name},\n\nA new login was detected on your MaintainIQ account at ${new Date().toLocaleString()}.\n\nIf this was not you, please secure your credentials immediately.\n\nBest regards,\nMaintainIQ Team`,
  }).catch((err) => console.error('Failed to send login alert email:', err.message));

  res.cookie('token', token, cookieOptions);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
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

module.exports = { register, login, logout, me };
