import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

<<<<<<< HEAD
const normalizeRole = (role) => {
  const rawRole = String(role || '').toLowerCase().trim();
  if (['superadmin', 'super_admin', 'admin'].includes(rawRole)) return 'super_admin';
  return 'doctor';
};

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, env.JWT_SECRET, {
=======
const generateToken = (id) => {
  return jwt.sign({ id }, env.JWT_SECRET, {
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
    expiresIn: env.JWT_EXPIRES_IN
  });
};

export const registerUser = asyncHandler(async (req, res) => {
<<<<<<< HEAD
  const { full_name, email, password, role = 'doctor' } = req.body;
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'super_admin') {
    throw new ApiError(403, 'Super admin accounts cannot be created through public registration');
  }

  if (!full_name || !email || !password) {
    throw new ApiError(400, 'Please provide name, email and password');
  }

  const userExists = await User.findOne({ email });
  if (userExists) throw new ApiError(409, 'User already exists with this email');

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    fullName: full_name,
    email,
    passwordHash: hashedPassword,
    role: normalizedRole
  });

  const token = generateToken(user._id, user.role);
  const userPayload = {
    _id: user._id,
    full_name: user.fullName,
    email: user.email,
    role: user.role
  };

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    access_token: token,
    token,
    user: userPayload,
    data: {
      access_token: token,
      token,
      user: userPayload
=======
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
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
    }
  });
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

<<<<<<< HEAD
  const user = await User.findOne({ email }).select('+passwordHash +password');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  let isPasswordValid = false;
  if (user.passwordHash) {
    isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  }

  if (!isPasswordValid && user.password) {
    isPasswordValid = user.password === password;
  }

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const normalizedRole = normalizeRole(user.role);
  if (user.role !== normalizedRole) {
    user.role = normalizedRole;
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is deactivated. Contact admin.');
  }

  if (!user.passwordHash && user.password) {
    const newHash = await bcrypt.hash(password, 10);
    await User.updateOne({ _id: user._id }, { $set: { passwordHash: newHash }, $unset: { password: '' } });
  }

  // Update last login and persist normalized role if needed
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id, user.role);
  const userPayload = {
    _id: user._id,
    full_name: user.fullName,
    email: user.email,
    role: user.role
  };

  res.json({
    success: true,
    message: 'Login successful',
    access_token: token,
    token,
    user: userPayload,
    data: {
      access_token: token,
      token,
      user: userPayload
    }
  });
});

export const validateToken = asyncHandler(async (req, res) => {
  // Token is already validated by the protect middleware
  // This endpoint returns the current user data if token is valid
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new ApiError(401, 'User not found');
  }

  const userPayload = {
    _id: user._id,
    full_name: user.fullName,
    email: user.email,
    role: user.role
  };

  res.json({
    success: true,
    data: {
      user: userPayload
    }
  });
});

export const logoutUser = asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is handled client-side
  // by removing the token. This endpoint can be used for
  // server-side cleanup if needed (e.g., blacklisting tokens)
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
=======
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
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
});