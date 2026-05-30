import mongoose from 'mongoose';
import crypto from 'crypto';

const generateAppointmentReferenceCode = () => `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const appointmentSchema = new mongoose.Schema({
  consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation' },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  preferredDate: { type: String, required: true },
  reason: String,
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referenceCode: { type: String, unique: true, sparse: true, default: generateAppointmentReferenceCode },
  invitationSent: { type: Boolean, default: false },
  invitationSentAt: Date,
  confirmedAt: Date,
  followUpId: { type: mongoose.Schema.Types.ObjectId, ref: 'FollowUp' },
  followUpCreatedAt: Date,
  status: { type: String, enum: ['pending','confirmed','completed','cancelled'], default: 'pending' }
}, { timestamps: true });
export const Appointment = mongoose.model('Appointment', appointmentSchema);