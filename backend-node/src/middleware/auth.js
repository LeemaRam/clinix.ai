import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const normalizeRole = (role) => {
  const rawRole = String(role || '').toLowerCase().trim();
  if (['superadmin', 'super_admin', 'admin'].includes(rawRole)) return 'super_admin';
  return 'doctor';
};

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Not authorized - No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) throw new ApiError(401, 'User not found');

    const normalizedRole = normalizeRole(user.role);
    if (user.role !== normalizedRole) {
      user.role = normalizedRole;
      await user.save();
    }

    if (!user.isActive) throw new ApiError(403, 'Account is deactivated');

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token has expired'));
    }
    next(new ApiError(401, 'Not authorized'));
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Role ${req.user.role} is not authorized to access this route`));
    }
    next();
  };
};

export const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return next(new ApiError(403, 'Super Admin access only'));
  }
  next();
};

export const authRequired = protect;
export const roleRequired = authorize;
