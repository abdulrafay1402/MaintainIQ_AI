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
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role,
    expertise: Array.isArray(expertise) ? expertise : [],
    isActive: true,
    isVerified: true,
  });

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

module.exports = { getTechnicians, getUsers, createUser };
