import { Consultation } from '../models/Consultation.js';

export const recordConsultationAnalytics = async ({ consultation, transcription, task }) => {
  if (!consultation || !transcription || !task) return;

  try {
    consultation.metadata = consultation.metadata || {};
    consultation.metadata.workflowMetrics = {
      aiTaskId: task._id?.toString?.() || null,
      workflowStage: task.currentStep || 'unknown',
      workflowStatus: task.status || 'unknown',
      transcriptionConfidence: transcription.confidenceScore || 0,
      transcriptionDuration: transcription.duration || 0,
      hasFollowUp: Boolean(transcription.analysis?.follow_up_days),
      updatedAt: new Date()
    };
    consultation.metadata.workflowUpdatedAt = new Date();
    await consultation.save();
    console.log('[analyticsService] Recorded workflow analytics for consultation', consultation._id.toString());
  } catch (error) {
    console.error('[analyticsService] Failed to persist consultation analytics:', error);
  }
};
