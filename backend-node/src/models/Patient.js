import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

const patientSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: String,
    phone: String,
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, required: true },
    bloodType: String,
    address: String,
    emergencyContactName: String,
    emergencyContactPhone: String,
    medicalConditions: { type: [String], default: [] },
    allergies: { type: [String], default: [] },
    currentMedications: { type: [String], default: [] },
    vitalSigns: { type: [mongoose.Schema.Types.Mixed], default: [] },
    notes: { type: [noteSchema], default: [] },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, default: 'new' },
    lastVisit: Date
  },
  { timestamps: true }
);

export const Patient = mongoose.model('Patient', patientSchema);
