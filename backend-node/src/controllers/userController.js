import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const data = { fullName: user.fullName || '', email: user.email, phone: user.phone || '' };
  res.json({ success: true, data, ...data });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.fullName = req.body.fullName ?? user.fullName;
  user.phone = req.body.phone ?? user.phone;
  await user.save();
  res.json({ success: true, data: { updated: true }, updated: true });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  const ok = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!ok) return res.status(400).json({ success: false, error: 'Invalid current password' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ success: true, data: { changed: true }, changed: true });
});

export const getLanguage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const data = { language: user?.language || 'en' };
  res.json({ success: true, data, ...data });
});

export const setLanguage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.language = req.body.language || 'en';
  await user.save();
  res.json({ success: true, data: { updated: true }, updated: true });
});
