import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

export const authRequired = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Missing auth token' });
    }

    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub).lean();

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Invalid user' });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };

    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

export const roleRequired = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  return next();
};
