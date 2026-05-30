import mongoose from 'mongoose';
import crypto from 'crypto';

const generateFollowUpReferenceCode = () => `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const followUpSchema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  followUpDate: { type: Date, required: true },
  followUpReason: String,
  patientPhone: String,
  referenceCode: { type: String, unique: true, sparse: true, index: true, default: generateFollowUpReferenceCode },
  invitationSent: { type: Boolean, default: false },
  reminderSent: { type: Boolean, default: false },
  reminderSentAt: Date,
  reminderClaimedAt: Date,
  confirmedAt: Date,
  declinedAt: Date,
  appointmentCreatedAt: Date,
  reminderStage: { type: String, enum: ['none','day-before','day-of','during'], default: 'none' },
  status: { type: String, enum: ['pending','confirmed','declined','completed','missed'], default: 'pending' }
}, { timestamps: true });
export const FollowUp = mongoose.model('FollowUp', followUpSchema);