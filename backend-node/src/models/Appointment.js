import mongoose from 'mongoose';
const appointmentSchema = new mongoose.Schema({
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  preferredDate: { type: String, required: true },
  reason: String,
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending','confirmed','cancelled'], default: 'pending' }
}, { timestamps: true });
export const Appointment = mongoose.model('Appointment', appointmentSchema);