import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: { type: String, required: true },
    format: { type: String, default: 'SOAP' },
    options: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, default: 'generated' },
    filePath: String,
    generatedBy: { type: String, default: 'System' }
  },
  { timestamps: true }
);

export const Report = mongoose.model('Report', reportSchema);
