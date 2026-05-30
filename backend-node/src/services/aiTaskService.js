import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Transcription } from '../models/Transcription.js';
import { AiTask } from '../models/AiTask.js';
import { getSocketServer } from '../socket.js';
import {
  WORKFLOW_STAGES,
  WORKFLOW_PROGRESS,
  buildPatientFileSummaries,
  runTranscriptionWorker,
  runMedicalAnalysisWorker,
  runSoapWorker,
  runDrugSafetyWorker,
  runPatientContextWorker,
  runFollowupWorker,
  runAnalyticsWorker
} from './aiWorkflowService.js';

const runningTasks = new Set();

const emitSocket = (consultationId, payload, eventName = 'transcription_progress') => {
  const io = getSocketServer();
  if (!io) return;
  io.to(`consultation:${consultationId}`).emit(eventName, payload);
  io.emit(eventName, payload);
};

const updateTask = async (task, update) => {
  Object.assign(task, update);
  // Mark Mixed type fields as modified for Mongoose to detect changes
  if (update.result) {
    task.markModified('result');
  }
  if (update.meta) {
    task.markModified('meta');
  }
  return task.save();
};

export const createAiTask = async ({ consultationId, patientId, doctorId }) => {
  const existing = await AiTask.findOne({
    consultationId,
    status: { $in: ['queued', 'processing'] }
  });
  if (existing) {
    return existing;
  }

  return AiTask.create({
    consultationId,
    patientId,
    doctorId,
    taskType: 'consultation_pipeline',
    status: 'queued',
    progress: 0,
    currentStep: 'queued',
    result: {},
    meta: { attempts: 0 }
  });
};

export const resumePendingAiTasks = async () => {
  const pendingTasks = await AiTask.find({ status: { $in: ['queued', 'processing'] } });
  for (const task of pendingTasks) {
    void processConsultationAiTask(task._id).catch((error) => {
      console.error('[aiTaskService] Failed to resume AI task:', task._id.toString(), error);
    });
  }
};

const mergeUniqueStrings = (existing = [], incoming = []) => Array.from(new Set([
  ...((Array.isArray(existing) ? existing : []).filter(Boolean).map(String)),
  ...((Array.isArray(incoming) ? incoming : []).filter(Boolean).map(String))
]));

const extractClinicalConditions = (text) => {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const matches = [];
  const patterns = [
    /diagnosis[:\s]*([^\.]+)/gi,
    /assessment[:\s]*([^\.]+)/gi,
    /impression[:\s]*([^\.]+)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      if (match[1]) matches.push(match[1].trim());
    }
  }

  if (matches.length === 0) {
    matches.push(normalized);
  }

  const conditionKeywords = [
    'GERD', 'gastritis', 'reflux', 'ulcer', 'hypertension', 'diabetes', 'asthma', 'COPD', 'arthritis',
    'migraine', 'infection', 'anemia', 'cancer', 'tumor', 'heart failure', 'depression', 'anxiety',
    'dementia', 'stroke', 'renal', 'hepatic', 'pneumonia', 'bronchitis', 'eczema', 'psoriasis',
    'insomnia', 'hyperlipidemia', 'thyroidism', 'obesity', 'constipation', 'diarrhea', 'arrhythmia'
  ];

  return matches
    .flatMap((candidate) => candidate.split(/[,;]\s*|\band\b/i).map((chunk) => chunk.trim()))
    .map((chunk) => chunk.replace(/^[\s\-:;]+|[\s\-:;]+$/g, ''))
    .filter((chunk) => chunk.length > 3)
    .filter((chunk) => conditionKeywords.some((keyword) => new RegExp(`\\b${keyword}\\b`, 'i').test(chunk)))
    .map((chunk) => chunk.replace(/\.$/, '').trim())
    .filter(Boolean);
};

const syncPatientProfile = async ({ patient, transcription, consultation }) => {
  if (!patient || !transcription || !consultation) return;

  const analysis = transcription.analysis || {};
  const medicalInfo = analysis.medical_info || {};

  const extractedMedications = Array.isArray(analysis.medications_mentioned)
    ? analysis.medications_mentioned.map(String).filter(Boolean)
    : [];

  const extractedConditions = mergeUniqueStrings(
    Array.isArray(medicalInfo.medical_history) ? medicalInfo.medical_history : [],
    Array.isArray(medicalInfo.diagnosis) ? medicalInfo.diagnosis : [],
    Array.isArray(analysis.diagnosis) ? analysis.diagnosis : [],
    extractClinicalConditions(String(analysis.assessment || '')),
    extractClinicalConditions(String(analysis.subjective || ''))
  );

  const updatedFields = {};
  if (extractedMedications.length > 0) {
    const mergedMedications = mergeUniqueStrings(patient.currentMedications, extractedMedications);
    if (mergedMedications.length > 0 && JSON.stringify(mergedMedications) !== JSON.stringify(patient.currentMedications || [])) {
      updatedFields.currentMedications = mergedMedications;
    }
  }

  if (extractedConditions.length > 0) {
    const mergedConditions = mergeUniqueStrings(patient.medicalConditions, extractedConditions);
    if (mergedConditions.length > 0 && JSON.stringify(mergedConditions) !== JSON.stringify(patient.medicalConditions || [])) {
      updatedFields.medicalConditions = mergedConditions;
      console.log('[aiTaskService] Syncing extracted clinical conditions to patient profile', {
        patientId: patient._id?.toString?.(),
        extractedConditions: mergedConditions
      });
    }
  }

  const lastVisit = consultation.endedAt || consultation.startedAt || new Date();
  if (!patient.lastVisit || new Date(patient.lastVisit).getTime() < lastVisit.getTime()) {
    updatedFields.lastVisit = lastVisit;
  }

  if (Object.keys(updatedFields).length > 0) {
    Object.assign(patient, updatedFields);
    await patient.save();
  }
};

const updateProgress = async (task, consultationId, progress, currentStep, status, result = undefined) => {
  const update = { currentStep, progress };
  if (status) update.status = status;
  if (typeof result !== 'undefined') update.result = result;
  if (status === 'processing' && !task.startedAt) update.startedAt = new Date();
  if (status === 'completed' || status === 'failed' || status === 'partial') update.completedAt = new Date();

  const updatedTask = await updateTask(task, update);
  emitSocket(consultationId, {
    consultationId: consultationId.toString(),
    progress,
    status,
    currentStep,
    taskId: updatedTask._id.toString()
  });
  return updatedTask;
};

const safeEmitCompletion = (consultationId, status, currentStep, taskId) => {
  const payload = { consultationId: consultationId.toString(), progress: status === 'completed' ? 100 : 100, status, currentStep, taskId };
  emitSocket(consultationId, payload, 'ai_task_status');
  emitSocket(consultationId, payload, 'transcription_progress');
};

export const processConsultationAiTask = async (taskId) => {
  const normalizedTaskId = taskId.toString();
  if (runningTasks.has(normalizedTaskId)) {
    return;
  }
  runningTasks.add(normalizedTaskId);

  let task = null;
  try {
    task = await AiTask.findById(taskId);
    if (!task) return;

    const consultation = await Consultation.findById(task.consultationId);
    console.log('[aiTaskService] Processing AI task', task._id.toString(), 'for consultation', task.consultationId.toString());
    if (!consultation) {
      await updateTask(task, {
        status: 'failed',
        error: 'Consultation not found',
        progress: 100,
        currentStep: 'consultation_lookup',
        completedAt: new Date()
      });
      return;
    }

    const transcription = await Transcription.findOne({ consultationId: consultation._id });
    if (!transcription) {
      await updateTask(task, {
        status: 'failed',
        error: 'Transcription record missing',
        progress: 100,
        currentStep: 'transcription_lookup',
        completedAt: new Date()
      });
      return;
    }

    const patient = await Patient.findById(consultation.patientId);
    if (!patient) {
      await updateTask(task, {
        status: 'failed',
        error: 'Patient not found',
        progress: 100,
        currentStep: 'patient_lookup',
        completedAt: new Date()
      });
      return;
    }

    let partialFailure = false;
    let soapNoteText = '';
    let patientFileSummaries = [];

    try {
      await updateProgress(task, consultation._id, WORKFLOW_PROGRESS[WORKFLOW_STAGES.transcription], WORKFLOW_STAGES.transcription, 'processing');
      console.log('[aiTaskService] Transcription step started', {
        taskId: task._id.toString(),
        consultationId: consultation._id.toString(),
        audioFilePath: consultation.audioFilePath,
        speechLanguage: transcription.speechLanguage
      });

      const speechLanguage = String(transcription.speechLanguage || 'en').toLowerCase().startsWith('ur') ? 'ur' : 'en';
      const transcriptionResult = await runTranscriptionWorker({ consultation, speechLanguage, transcription });
      console.log('[aiTaskService] Transcription result received', {
        consultationId: consultation._id.toString(),
        taskId: task._id.toString(),
        transcriptLength: transcriptionResult.transcript.length,
        duration: transcriptionResult.duration,
        segments: transcriptionResult.segments.length,
        language: transcriptionResult.language,
        modelUsed: transcriptionResult.modelUsed
      });

      transcription.rawText = transcriptionResult.transcript;
      transcription.segments = transcriptionResult.segments;
      transcription.confidenceScore = transcriptionResult.confidenceScore;
      transcription.duration = transcriptionResult.duration;
      transcription.language = transcriptionResult.language;
      transcription.modelUsed = transcriptionResult.modelUsed;
      transcription.status = 'completed';
      transcription.startedAt = transcription.startedAt || new Date();
      transcription.completedAt = new Date();
      console.log('[aiTaskService] Saving transcription to MongoDB', {
        consultationId: consultation._id.toString(),
        transcriptionId: transcription._id?.toString(),
        rawTextLength: transcription.rawText.length,
        duration: transcription.duration
      });
      await transcription.save();
      console.log('[aiTaskService] Transcription saved to MongoDB', {
        consultationId: consultation._id.toString(),
        transcriptionId: transcription._id?.toString(),
        createdAt: transcription.createdAt,
        updatedAt: transcription.updatedAt
      });

      task.result.transcription = {
        rawText: transcription.rawText,
        segments: transcription.segments,
        confidenceScore: transcription.confidenceScore,
        duration: transcription.duration,
        language: transcription.language,
        modelUsed: transcription.modelUsed
      };

      await updateProgress(task, consultation._id, WORKFLOW_PROGRESS[WORKFLOW_STAGES.medical_analysis], WORKFLOW_STAGES.medical_analysis, 'processing', task.result);
      const analysis = await runMedicalAnalysisWorker({ rawText: transcription.rawText });
      transcription.analysis = analysis;
      await transcription.save();

      task.result.analysis = analysis;
      await updateProgress(task, consultation._id, WORKFLOW_PROGRESS[WORKFLOW_STAGES.soap_generation], WORKFLOW_STAGES.soap_generation, 'processing', task.result);

      try {
        const soapResult = await runSoapWorker({ rawText: transcription.rawText, patient, consultationType: consultation.consultationType });
        soapNoteText = soapResult.soapNote;
        transcription.analysis = { ...transcription.analysis, soap_note: soapNoteText };
        task.result.soapNote = soapNoteText;
      } catch (soapError) {
        partialFailure = true;
        const fallbackSoap = 'SOAP generation failed. Please review transcription manually.';
        transcription.analysis = {
          ...transcription.analysis,
          soap_note_error: String(soapError?.message || soapError || 'SOAP note generation failed'),
          soap_note: fallbackSoap
        };
        task.result.soapError = String(soapError?.message || soapError || 'SOAP note generation failed');
        task.result.soapNote = fallbackSoap;
      }
      await transcription.save();

      await updateProgress(task, consultation._id, WORKFLOW_PROGRESS[WORKFLOW_STAGES.clinical_context], WORKFLOW_STAGES.clinical_context, 'processing', task.result);
      try {
        patientFileSummaries = patient.uploadedFiles && patient.uploadedFiles.length
          ? await buildPatientFileSummaries(patient.uploadedFiles)
          : [];

        const [drugSafetyResult, patientBriefResult] = await Promise.all([
          runDrugSafetyWorker({ consultation, transcription, patient, patientFileSummaries }),
          runPatientContextWorker({ patient, consultations: await Consultation.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(10).lean(), reports: await Consultation.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(5).lean(), patientFileSummaries })
        ]);

        task.result.drugSafety = drugSafetyResult;
        task.result.patientBrief = patientBriefResult;
      } catch (contextError) {
        partialFailure = true;
        task.result.contextError = String(contextError?.message || contextError || 'Context worker failed');
        task.result.drugSafety = task.result.drugSafety || { status: 'failed', message: 'Drug safety check failed' };
        task.result.patientBrief = task.result.patientBrief || { summary: 'Patient context generation failed. Please review manually.' };
      }

      await updateProgress(task, consultation._id, WORKFLOW_PROGRESS[WORKFLOW_STAGES.followup], WORKFLOW_STAGES.followup, 'processing', task.result);
      try {
        const followUpResult = await runFollowupWorker({ consultation, patient, transcription });
        task.result.followUp = followUpResult;
      } catch (followUpError) {
        partialFailure = true;
        task.result.followUpError = String(followUpError?.message || followUpError || 'Follow-up scheduling failed');
      }

      consultation.status = 'transcribed';
      consultation.endedAt = new Date();
      consultation.languageDetected = transcription.language;
      consultation.consultationSummary = [
        transcription.analysis?.subjective,
        transcription.analysis?.assessment,
        transcription.analysis?.soap_note || ''
      ].filter(Boolean).join(' | ').slice(0, 1000);
      console.log('[aiTaskService] Saving consultation update to MongoDB', {
        consultationId: consultation._id.toString(),
        status: consultation.status,
        languageDetected: consultation.languageDetected,
        summaryLength: consultation.consultationSummary.length
      });
      await consultation.save();
      console.log('[aiTaskService] Consultation saved to MongoDB', {
        consultationId: consultation._id.toString(),
        updatedAt: consultation.updatedAt
      });

      await syncPatientProfile({ patient, transcription, consultation });

      consultation.medicalInfo = {
        medications_mentioned: transcription.analysis?.medications_mentioned || [],
        follow_up_days: transcription.analysis?.follow_up_days || 7,
        soap: {
          ...transcription.analysis,
          note: soapNoteText
        }
      };
      consultation.soapApprovalStatus = 'pending';
      consultation.drugCheckStatus = task.result.drugSafety ? 'completed' : consultation.drugCheckStatus || 'pending';
      consultation.audioDuration = transcription.duration;
      await consultation.save();

      const workflowStatus = partialFailure ? 'partial' : 'completed';
      task.result.status = workflowStatus;

      await updateProgress(task, consultation._id, WORKFLOW_PROGRESS[WORKFLOW_STAGES.analytics], WORKFLOW_STAGES.analytics, 'processing', task.result);
      void runAnalyticsWorker({ consultation, transcription, task });

      await updateProgress(task, consultation._id, WORKFLOW_PROGRESS[WORKFLOW_STAGES.completed], WORKFLOW_STAGES.completed, workflowStatus, task.result);
      safeEmitCompletion(consultation._id, workflowStatus, WORKFLOW_STAGES.completed, task._id);
    } catch (error) {
      const errorMessage = String(error?.message || error || 'Unknown task failure');
      transcription.status = 'failed';
      transcription.errorMessage = errorMessage;
      transcription.completedAt = new Date();
      await transcription.save();

      consultation.status = 'failed';
      await consultation.save();

      await updateTask(task, {
        status: 'failed',
        error: errorMessage,
        currentStep: WORKFLOW_STAGES.failed,
        progress: 100,
        result: task.result,
        completedAt: new Date()
      });

      safeEmitCompletion(consultation._id, 'failed', WORKFLOW_STAGES.failed, task._id);
    }
  } catch (error) {
    const errorMessage = String(error?.message || error || 'Unknown task failure');
    if (task) {
      await updateTask(task, {
        status: 'failed',
        error: errorMessage,
        currentStep: 'failed',
        progress: 100,
        result: task.result,
        completedAt: new Date()
      });
    }
  } finally {
    runningTasks.delete(normalizedTaskId);
  }
};
