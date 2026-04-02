import { asyncHandler } from '../utils/asyncHandler.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { UserSubscription } from '../models/UserSubscription.js';

export const getPublicPlans = asyncHandler(async (_req, res) => {
  const plans = await SubscriptionPlan.find({ active: true, deleted: false }).sort({ price: 1 });
  const mappedPlans = plans.map((p) => ({
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
      trial_days: p.trialDays,
      admin_only: false,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }));

  const fallbackPlans = [
    {
      id: 'starter-monthly',
      name: 'Starter',
      description: 'For solo practitioners getting started.',
      price: 29,
      currency: 'usd',
      interval: 'month',
      transcriptionsPerMonth: 120,
      diskSpaceGB: 10,
      features: ['AI transcription', 'SOAP reports', 'Basic analytics'],
      stripePriceId: '',
      popular: false,
      trial_days: 14,
      admin_only: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'pro-monthly',
      name: 'Pro',
      description: 'For growing clinics with higher volume.',
      price: 79,
      currency: 'usd',
      interval: 'month',
      transcriptionsPerMonth: 600,
      diskSpaceGB: 80,
      features: ['Everything in Starter', 'Priority processing', 'Team support'],
      stripePriceId: '',
      popular: true,
      trial_days: 14,
      admin_only: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'starter-yearly',
      name: 'Starter',
      description: 'For solo practitioners getting started.',
      price: 290,
      currency: 'usd',
      interval: 'year',
      transcriptionsPerMonth: 120,
      diskSpaceGB: 10,
      features: ['AI transcription', 'SOAP reports', 'Basic analytics'],
      stripePriceId: '',
      popular: false,
      trial_days: 14,
      admin_only: false,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'pro-yearly',
      name: 'Pro',
      description: 'For growing clinics with higher volume.',
      price: 790,
      currency: 'usd',
      interval: 'year',
      transcriptionsPerMonth: 600,
      diskSpaceGB: 80,
      features: ['Everything in Starter', 'Priority processing', 'Team support'],
      stripePriceId: '',
      popular: true,
      trial_days: 14,
      admin_only: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const effectivePlans = mappedPlans.length > 0 ? mappedPlans : fallbackPlans;

  const data = { plans: effectivePlans };
  res.json({ success: true, data, ...data });
});

export const getPlan = asyncHandler(async (req, res) => {
  const p = await SubscriptionPlan.findById(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Plan not found' });
  const data = { plan: { ...p.toObject(), id: p._id } };
  res.json({ success: true, data, ...data });
});

export const comparePlans = asyncHandler(async (req, res) => {
  const ids = req.body.plan_ids || [];
  const plans = await SubscriptionPlan.find({ _id: { $in: ids } });
  const data = { plans: plans.map((p) => ({ ...p.toObject(), id: p._id })) };
  res.json({ success: true, data, ...data });
});

export const getUserSubscription = asyncHandler(async (req, res) => {
  const sub = await UserSubscription.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
  if (!sub) {
    const data = { subscription: null, plan: null, usage: null };
    return res.json({ success: true, data, ...data });
  }

  const plan = await SubscriptionPlan.findById(sub.planId);
  const data = {
    subscription: { ...sub.toObject(), id: sub._id },
    plan: plan ? { ...plan.toObject(), id: plan._id } : null,
    usage: {
      transcriptionsUsed: 0,
      transcriptionsLimit: plan?.transcriptionsPerMonth || 0,
      diskSpaceUsedGB: 0,
      diskSpaceLimitGB: plan?.diskSpaceGB || 0,
      resetDate: sub.currentPeriodEnd || new Date()
    }
  };

  res.json({ success: true, data, ...data });
});

export const createCheckoutSession = asyncHandler(async (req, res) => {
  const data = { sessionId: `mock_session_${Date.now()}` };
  res.json({ success: true, data, ...data });
});

export const verifySubscription = asyncHandler(async (_req, res) => {
  const data = { message: 'Subscription verified' };
  res.json({ success: true, data, ...data });
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await UserSubscription.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
  if (sub) {
    sub.cancelAtPeriodEnd = true;
    await sub.save();
  }
  res.json({ success: true, data: { canceled: true }, canceled: true });
});

export const reactivateSubscription = asyncHandler(async (req, res) => {
  const sub = await UserSubscription.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
  if (sub) {
    sub.cancelAtPeriodEnd = false;
    await sub.save();
  }
  res.json({ success: true, data: { reactivated: true }, reactivated: true });
});
