import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

const generateToken = (id) => {
  return jwt.sign({ id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
};

export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'doctor' } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Please provide name, email and password');
  }

  const userExists = await User.findOne({ email: String(email).toLowerCase() });
  if (userExists) throw new ApiError(400, 'User already exists with this email');

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    fullName: name,
    email: String(email).toLowerCase(),
    passwordHash,
    role: role || 'doctor'
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      _id: user._id,
      full_name: user.fullName,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    }
  });
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const ok = await bcrypt.compare(password || '', user.passwordHash || '');
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  if (user.isActive === false) {
    throw new ApiError(403, 'Account is deactivated. Contact admin.');
  }

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      _id: user._id,
      full_name: user.fullName,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    }
  });
});