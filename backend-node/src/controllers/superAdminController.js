import bcrypt from 'bcryptjs';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';

const languageState = {
  uiLanguages: [
    { code: 'en', name: 'English', enabled: true, isUILanguage: true, isSpeechLanguage: false },
    { code: 'ur', name: 'Urdu', enabled: true, isUILanguage: true, isSpeechLanguage: false }
  ],
  speechLanguages: [
    { code: 'en-US', name: 'English (US)', enabled: true },
    { code: 'ur-PK', name: 'Urdu (Pakistan)', enabled: true }
  ],
  defaultLanguage: 'en'
};

export const getStats = asyncHandler(async (_req, res) => {
  const [users, doctors, plans] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ role: 'doctor' }),
    SubscriptionPlan.countDocuments({ deleted: { $ne: true } })
  ]);
  res.json({ totalUsers: users, totalDoctors: doctors, totalPlans: plans });
});

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 });
  res.json({
    users: users.map((u) => ({
      id: u._id,
      full_name: u.fullName,
      email: u.email,
      role: u.role,
      is_active: u.isActive,
      language: u.language || 'en',
      created_at: u.createdAt
    }))
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { full_name, email, password, role } = req.body;
  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) return res.status(409).json({ success: false, error: 'Email already exists' });

  const user = await User.create({
    fullName: full_name,
    email: String(email).toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    role: role || 'doctor'
  });

  res.status(201).json({
    user: {
      id: user._id,
      full_name: user.fullName,
      email: user.email,
      role: user.role,
      is_active: user.isActive
    }
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });

  user.fullName = req.body.full_name ?? user.fullName;
  user.email = req.body.email ? String(req.body.email).toLowerCase() : user.email;
  user.role = req.body.role ?? user.role;
  await user.save();

  res.json({ user: { id: user._id, full_name: user.fullName, email: user.email, role: user.role, is_active: user.isActive } });
});

export const deleteUser = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  user.isActive = !user.isActive;
  await user.save();
  res.json({ user: { id: user._id, is_active: user.isActive } });
});

export const getLanguages = asyncHandler(async (_req, res) => {
  res.json(languageState);
});

export const updateUiLanguages = asyncHandler(async (req, res) => {
  languageState.uiLanguages = req.body.languages || languageState.uiLanguages;
  res.json({ success: true });
});

export const updateSpeechLanguages = asyncHandler(async (req, res) => {
  languageState.speechLanguages = req.body.languages || languageState.speechLanguages;
  res.json({ success: true });
});

export const updateDefaultLanguage = asyncHandler(async (req, res) => {
  languageState.defaultLanguage = req.body.defaultLanguage || 'en';
  res.json({ success: true });
});

const serializePlan = (p) => ({
  id: p._id,
  name: p.name,
  description: p.description,
  price: p.price,
  currency: p.currency,
  interval: p.interval,
  transcriptionsPerMonth: p.transcriptionsPerMonth,
  diskSpaceGB: p.diskSpaceGB,
  features: p.features,
  stripePriceId: p.stripePriceId,
  popular: p.popular,
  active: p.active,
  trial_days: p.trialDays,
  admin_only: false,
  created_at: p.createdAt,
  updated_at: p.updatedAt
});

export const listPlans = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const search = String(req.query.search || '');

  const query = { deleted: { $ne: true } };
  if (search) query.name = { $regex: search, $options: 'i' };

  const [plans, total] = await Promise.all([
    SubscriptionPlan.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SubscriptionPlan.countDocuments(query)
  ]);

  res.json({ plans: plans.map(serializePlan), total, page, pages: Math.ceil(total / limit), hasMore: page * limit < total });
});

export const getPlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
  res.json({ plan: { ...serializePlan(plan), statistics: { active_subscriptions: 0, total_subscriptions: 0, monthly_revenue: 0, signup_trend: [] } } });
});

export const createPlan = asyncHandler(async (req, res) => {
  const body = req.body;
  const plan = await SubscriptionPlan.create({
    name: body.name,
    description: body.description,
    price: body.price,
    currency: body.currency || 'USD',
    interval: body.interval,
    transcriptionsPerMonth: body.transcriptionsPerMonth || 0,
    diskSpaceGB: body.diskSpaceGB || 0,
    features: body.features || [],
    stripePriceId: body.stripePriceId,
    popular: Boolean(body.popular),
    active: body.active !== false,
    trialDays: body.trial_days || 0
  });
  res.status(201).json({ plan: serializePlan(plan) });
});

export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

  Object.assign(plan, {
    name: req.body.name ?? plan.name,
    description: req.body.description ?? plan.description,
    price: req.body.price ?? plan.price,
    currency: req.body.currency ?? plan.currency,
    interval: req.body.interval ?? plan.interval,
    transcriptionsPerMonth: req.body.transcriptionsPerMonth ?? plan.transcriptionsPerMonth,
    diskSpaceGB: req.body.diskSpaceGB ?? plan.diskSpaceGB,
    features: req.body.features ?? plan.features,
    stripePriceId: req.body.stripePriceId ?? plan.stripePriceId,
    popular: req.body.popular ?? plan.popular,
    active: req.body.active ?? plan.active,
    trialDays: req.body.trial_days ?? plan.trialDays
  });

  await plan.save();
  res.json({ plan: serializePlan(plan) });
});

export const togglePlanStatus = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
  plan.active = !plan.active;
  await plan.save();
  res.json({ plan: serializePlan(plan), message: 'Plan status updated' });
});

export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });
  plan.deleted = true;
  await plan.save();
  res.json({ success: true });
});

export const duplicatePlan = asyncHandler(async (req, res) => {
  const plan = await SubscriptionPlan.findById(req.params.id);
  if (!plan) return res.status(404).json({ success: false, error: 'Plan not found' });

  const clone = await SubscriptionPlan.create({
    ...plan.toObject(),
    _id: undefined,
    name: req.body.name || `${plan.name} Copy`,
    interval: req.body.interval || plan.interval
  });

  res.status(201).json({ plan: serializePlan(clone) });
});
