import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    stripePriceId: String,
    price: Number,
    currency: { type: String, default: 'USD' },
    interval: { type: String, enum: ['month', 'year', 'trial'], required: true },
    transcriptionsPerMonth: { type: Number, default: 0 },
    diskSpaceGB: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    popular: { type: Boolean, default: false },
    trialDays: { type: Number, default: 0 },
    features: { type: [String], default: [] },
    deleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
