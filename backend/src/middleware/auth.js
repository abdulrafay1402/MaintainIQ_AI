const jwt = require('jsonwebtoken');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new ApiError(401, 'Not authorized, token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new ApiError(401, 'User not found'));
    }

    // A token is not enough — the account must also still be active and approved.
    if (!user.isActive) {
      return next(new ApiError(403, 'This account has been deactivated'));
    }
    if (user.approvalStatus && user.approvalStatus !== 'approved') {
      return next(new ApiError(403, 'Your account is awaiting admin approval'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new ApiError(401, 'Not authorized, token invalid'));
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, 'Not authorized'));
  }

  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'Forbidden'));
  }

  next();
};

module.exports = { protect, authorizeRoles };
