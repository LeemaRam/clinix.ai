import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeUser } from '../utils/serializers.js';

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });

export const register = asyncHandler(async (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ success: false, error: 'email, password and full_name are required' });
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    return res.status(409).json({ success: false, error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    fullName: full_name,
    role: 'doctor'
  });

  const access_token = signToken(user);
  return res.status(201).json({ access_token, user: serializeUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() });

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password || '', user.passwordHash);
  if (!ok) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  user.lastLogin = new Date();
  await user.save();

  const access_token = signToken(user);
  return res.json({ access_token, user: serializeUser(user) });
});

export const validateToken = asyncHandler(async (_req, res) => {
  res.json({ success: true });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).lean();

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  return res.json({ user: serializeUser(user) });
});
