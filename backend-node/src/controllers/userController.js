import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/User.js';
import {
  validateName,
  validatePassword,
  validateEnum,
  collectErrors,
  throwIfErrors
} from '../utils/validation.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, 'User not found'));
  }

  const data = {
    _id: user._id,
    fullName: user.fullName || '',
    email: user.email,
    role: user.role,
    language: user.language || 'en',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  res.json(new ApiResponse(200, data, 'Profile retrieved successfully'));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, 'User not found'));
  }

  const body = req.body || {};
  const errors = collectErrors([
    body.fullName !== undefined ? ['fullName', validateName(body.fullName, { label: 'Full name' })] : [null, null],
    body.language !== undefined ? ['language', validateEnum(body.language, ['en', 'ur'], { label: 'Language' })] : [null, null]
  ].filter(([field]) => field));
  throwIfErrors(errors);

  if (body.fullName !== undefined) user.fullName = String(body.fullName).trim();
  if (body.language !== undefined) user.language = body.language;
  await user.save();

  const data = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    language: user.language,
    updatedAt: user.updatedAt
  };

  res.json(new ApiResponse(200, data, 'Profile updated successfully'));
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = await User.findById(req.user.id);

  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, 'User not found'));
  }

  const errors = collectErrors([
    ['currentPassword', currentPassword ? null : 'Current password is required'],
    ['newPassword', validatePassword(newPassword)]
  ]);
  throwIfErrors(errors);

  const isValidPassword = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!isValidPassword) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid current password'));
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json(new ApiResponse(200, { changed: true }, 'Password changed successfully'));
});

export const getLanguage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const data = { language: user?.language || 'en' };
  res.json(new ApiResponse(200, data, 'Language preference retrieved'));
});

export const setLanguage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, 'User not found'));
  }

  const langError = validateEnum(req.body?.language || 'en', ['en', 'ur'], { label: 'Language' });
  throwIfErrors(collectErrors([['language', langError]]));

  user.language = req.body.language || 'en';
  await user.save();

  res.json(new ApiResponse(200, { language: user.language }, 'Language preference updated'));
});
