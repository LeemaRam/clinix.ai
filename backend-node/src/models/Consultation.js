import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    consultationType: { type: String, required: true },
    recordingType: { type: String, required: true },
    consentObtained: { type: Boolean, default: false },
    consentTimestamp: Date,
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'recorded', 'transcribed', 'failed'],
      default: 'scheduled'
    },
    scheduledAt: Date,
    startedAt: Date,
    endedAt: Date,
    notes: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    audioFilePath: String,
    audioFileSize: Number,
    audioFormat: String,
    audioDuration: Number,
    languageDetected: String,
    medicalInfo: { type: mongoose.Schema.Types.Mixed },
    consultationSummary: String
  },
  { timestamps: true }
);

export const Consultation = mongoose.model('Consultation', consultationSchema);
