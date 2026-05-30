import mongoose from 'mongoose';

const aiTaskSchema = new mongoose.Schema(
  {
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskType: {
      type: String,
      enum: ['consultation_pipeline'],
      required: true,
      default: 'consultation_pipeline'
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'partial', 'completed', 'failed'],
      default: 'queued'
    },
    progress: { type: Number, default: 0 },
    currentStep: { type: String, default: 'queued' },
    error: { type: String, default: '' },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    startedAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);

export const AiTask = mongoose.model('AiTask', aiTaskSchema);
