import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    role: { type: String, enum: ['doctor', 'admin', 'super_admin'], default: 'doctor' },
    isActive: { type: Boolean, default: true },
    language: { type: String, default: 'en' },
    phone: { type: String, default: '' },
    subscriptionPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
