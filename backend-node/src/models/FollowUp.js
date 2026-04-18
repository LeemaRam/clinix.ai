import mongoose from 'mongoose';
const followUpSchema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  followUpDate: { type: Date, required: true },
  followUpReason: String,
  patientPhone: String,
  reminderSent: { type: Boolean, default: false },
  reminderSentAt: Date,
  status: { type: String, enum: ['pending','sent','completed','missed'], default: 'pending' }
}, { timestamps: true });
export const FollowUp = mongoose.model('FollowUp', followUpSchema);