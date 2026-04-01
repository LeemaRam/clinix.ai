import mongoose from 'mongoose';

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    stripeSubscriptionId: String,
    stripeCustomerId: String,
    status: { type: String, default: 'active' },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    isManualSubscription: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);
