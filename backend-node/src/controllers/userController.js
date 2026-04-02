import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ fullName: user.fullName || '', email: user.email, phone: user.phone || '' });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.fullName = req.body.fullName ?? user.fullName;
  user.phone = req.body.phone ?? user.phone;
  await user.save();
  res.json({ success: true });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const ok = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!ok) return res.status(400).json({ success: false, error: 'Invalid current password' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ success: true });
});

export const getLanguage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.json({ language: user?.language || 'en' });
});

export const setLanguage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.language = req.body.language || 'en';
  await user.save();
  res.json({ success: true });
});
