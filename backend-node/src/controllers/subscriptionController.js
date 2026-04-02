import { asyncHandler } from '../utils/asyncHandler.js';
import { SubscriptionPlan } from '../models/SubscriptionPlan.js';
import { UserSubscription } from '../models/UserSubscription.js';

export const getPublicPlans = asyncHandler(async (_req, res) => {
  const plans = await SubscriptionPlan.find({ active: true, deleted: false }).sort({ price: 1 });
  res.json({
    plans: plans.map((p) => ({
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
    }))
  });
});

export const getPlan = asyncHandler(async (req, res) => {
  const p = await SubscriptionPlan.findById(req.params.id);
  if (!p) return res.status(404).json({ success: false, error: 'Plan not found' });
  res.json({ plan: { ...p.toObject(), id: p._id } });
});

export const comparePlans = asyncHandler(async (req, res) => {
  const ids = req.body.plan_ids || [];
  const plans = await SubscriptionPlan.find({ _id: { $in: ids } });
  res.json({ plans: plans.map((p) => ({ ...p.toObject(), id: p._id })) });
});

export const getUserSubscription = asyncHandler(async (req, res) => {
  const sub = await UserSubscription.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
  if (!sub) return res.json({ subscription: null, plan: null, usage: null });

  const plan = await SubscriptionPlan.findById(sub.planId);
  res.json({
    subscription: { ...sub.toObject(), id: sub._id },
    plan: plan ? { ...plan.toObject(), id: plan._id } : null,
    usage: {
      transcriptionsUsed: 0,
      transcriptionsLimit: plan?.transcriptionsPerMonth || 0,
      diskSpaceUsedGB: 0,
      diskSpaceLimitGB: plan?.diskSpaceGB || 0,
      resetDate: sub.currentPeriodEnd || new Date()
    }
  });
});

export const createCheckoutSession = asyncHandler(async (req, res) => {
  res.json({ sessionId: `mock_session_${Date.now()}` });
});

export const verifySubscription = asyncHandler(async (_req, res) => {
  res.json({ success: true, message: 'Subscription verified' });
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const sub = await UserSubscription.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
  if (sub) {
    sub.cancelAtPeriodEnd = true;
    await sub.save();
  }
  res.json({ success: true });
});

export const reactivateSubscription = asyncHandler(async (req, res) => {
  const sub = await UserSubscription.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
  if (sub) {
    sub.cancelAtPeriodEnd = false;
    await sub.save();
  }
  res.json({ success: true });
});
