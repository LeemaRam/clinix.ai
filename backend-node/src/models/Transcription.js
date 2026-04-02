import mongoose from 'mongoose';

const segmentSchema = new mongoose.Schema(
  {
    id: Number,
    start: Number,
    end: Number,
    text: String,
    confidence: Number,
    noSpeechProb: Number,
    avgLogprob: Number,
    compressionRatio: Number,
    speaker: { type: String, default: 'unknown' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

const transcriptionSchema = new mongoose.Schema(
  {
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    audioFilePath: { type: String, required: true },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    language: { type: String, default: 'en' },
    speechLanguage: { type: String, default: 'en' },
    modelUsed: { type: String, default: 'whisper-1' },
    rawText: { type: String, default: '' },
    segments: { type: [segmentSchema], default: [] },
    confidenceScore: Number,
    duration: Number,
    processingTime: Number,
    processingMethod: { type: String, default: 'standard' },
    chunkCount: { type: Number, default: 1 },
    analysis: { type: mongoose.Schema.Types.Mixed, default: {} },
    errorMessage: String,
    startedAt: Date,
    completedAt: Date
  },
  { timestamps: true }
);

export const Transcription = mongoose.model('Transcription', transcriptionSchema);
