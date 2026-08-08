import { transcribeAudio, checkDrugInteractions } from './pythonService.js';
import path from 'path';
import { extractMedicalAnalysis, generateSOAPNote, generatePatientBrief, checkDrugSafety } from './openaiService.js';
import { analyzePatientFiles } from './patientFileAnalysisService.js';
import { recordConsultationAnalytics } from './analyticsService.js';
import { materializeStoredFileToLocalTemp } from './storage/index.js';

export const WORKFLOW_STAGES = {
  queued: 'queued',
  transcription: 'transcription',
  medical_analysis: 'medical_analysis',
  soap_generation: 'soap_generation',
  clinical_context: 'clinical_context',
  followup: 'followup',
  analytics: 'analytics',
  completed: 'completed',
  failed: 'failed'
};

export const WORKFLOW_PROGRESS = {
  [WORKFLOW_STAGES.transcription]: 20,
  [WORKFLOW_STAGES.medical_analysis]: 40,
  [WORKFLOW_STAGES.soap_generation]: 55,
  [WORKFLOW_STAGES.clinical_context]: 70,
  [WORKFLOW_STAGES.followup]: 85,
  [WORKFLOW_STAGES.analytics]: 95,
  [WORKFLOW_STAGES.completed]: 100
};

const normalizePatient = (patient) => (patient?.toObject ? patient.toObject() : patient || {});

export const buildPatientFileSummaries = async (patientFiles = []) => {
  if (!Array.isArray(patientFiles) || patientFiles.length === 0) return [];
  return analyzePatientFiles(patientFiles);
};

const resolveAudioTempExtension = ({ audioFilePath, mimeType }) => {
  const extFromPath = path.extname(String(audioFilePath || '')).trim();
  if (extFromPath) return extFromPath;

  const normalizedMime = String(mimeType || '').toLowerCase();
  const mimeToExt = {
    'audio/mpeg': '.mp3',
    'audio/mp3': '.mp3',
    'audio/mp4': '.mp4',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/webm': '.webm',
    'audio/ogg': '.ogg'
  };

  return mimeToExt[normalizedMime] || '.bin';
};

export const runTranscriptionWorker = async ({ consultation, speechLanguage, transcription }) => {
  const tempAudio = await materializeStoredFileToLocalTemp({
    storagePath: consultation.audioFilePath,
    preferredExtension: resolveAudioTempExtension({
      audioFilePath: consultation.audioFilePath,
      mimeType: consultation.audioFormat
    }),
    prefix: `consultation-audio-${consultation._id.toString()}`
  });

  let result;
  try {
    result = await transcribeAudio({
      audioFilePath: tempAudio.localPath,
      speechLanguage,
      consultationId: consultation._id.toString(),
      mimeType: consultation.audioFormat
    });
  } finally {
    await tempAudio.cleanup();
  }

  return {
    transcript: String(
      result.transcript ||
      result.raw_text ||
      result.text ||
      result.full_text ||
      result.transcription ||
      result.transcription_text ||
      ''
    ).trim(),
    segments: result.segments || [],
    confidenceScore: Number(result.confidence_score || result.confidence || 0),
    duration: Number(result.duration || result.audio_duration || 0),
    language: String(result.language || speechLanguage || 'en'),
    modelUsed: String(result.modelUsed || result.model_used || result.model || 'unknown'),
    source: 'python-ai-service'
  };
};

export const runMedicalAnalysisWorker = async ({ rawText }) => {
  return extractMedicalAnalysis(rawText);
};

export const runSoapWorker = async ({ rawText, patient, consultationType }) => {
  const soapResult = await generateSOAPNote({
    patient: normalizePatient(patient),
    transcription: rawText,
    consultationReason: consultationType
  });

  const soapNote = String(soapResult?.soapNote || '').trim();
  if (!soapNote) {
    throw new Error('Empty SOAP note returned from SOAP service');
  }

  return {
    soapNote,
    rawResponse: soapResult?.rawResponse || soapResult || {}
  };
};

export const runDrugSafetyWorker = async ({ consultation, transcription, patient, patientFileSummaries }) => {
  const patientObj = normalizePatient(patient);
  const medications = Array.isArray(transcription?.analysis?.medications_mentioned)
    ? transcription.analysis.medications_mentioned
    : [];
  const existingMedications = Array.isArray(patientObj.currentMedications)
    ? patientObj.currentMedications
    : [];

  console.log('[aiWorkflowService] Drug safety worker started', {
    consultationId: consultation?._id?.toString?.(),
    patientId: patientObj._id || patientObj.id || null,
    medications,
    existingMedications
  });

  if (medications.length === 0) {
    return { warnings: [], interactions: [], recommendations: [], status: 'skipped', safe: true };
  }

  const drugSafetyResult = await checkDrugSafety({
    medications,
    patientInfo: patientObj,
    patientFiles: patientFileSummaries || [],
    language: 'en'
  });

  let rxNormResult = { warnings: [], safe: true, note: 'RxNorm interaction check skipped' };
  try {
    if (medications.length > 1) {
      rxNormResult = await checkDrugInteractions({
        newDrugs: medications,
        existingDrugs: existingMedications
      });
    }
  } catch (error) {
    rxNormResult = {
      warnings: [],
      safe: true,
      note: String(error?.message || error || 'RxNorm interaction check failed')
    };
  }

  const formatRxNormWarning = (warning) => {
    if (typeof warning === 'string') return warning;
    if (warning && typeof warning === 'object') {
      return [
        warning.drugs ? `Drugs: ${Array.isArray(warning.drugs) ? warning.drugs.join(', ') : warning.drugs}` : null,
        warning.description ? `Description: ${warning.description}` : null,
        warning.severity ? `Severity: ${warning.severity}` : null
      ].filter(Boolean).join(' — ');
    }
    return String(warning);
  };

  const normalizedWarnings = [
    ...(Array.isArray(drugSafetyResult.warnings) ? drugSafetyResult.warnings.map(String).filter(Boolean) : []),
    ...(Array.isArray(rxNormResult.warnings) ? rxNormResult.warnings.map(formatRxNormWarning).filter(Boolean) : [])
  ].filter(Boolean);

  const combinedInteractions = [
    ...(Array.isArray(drugSafetyResult.interactions) ? drugSafetyResult.interactions.map(String).filter(Boolean) : []),
    ...(Array.isArray(rxNormResult.interactions) ? rxNormResult.interactions.map(String).filter(Boolean) : [])
  ].filter(Boolean);

  const combinedRecommendations = Array.isArray(drugSafetyResult.recommendations)
    ? drugSafetyResult.recommendations.map(String).filter(Boolean)
    : [];

  // Combine risk levels: prefer High > Moderate > Low
  const riskPriority = (level) => {
    if (!level) return 0;
    const l = String(level).toLowerCase();
    if (l === 'high') return 3;
    if (l === 'moderate') return 2;
    if (l === 'low') return 1;
    return 0;
  };

  const pickRiskLevel = () => {
    const candidates = [drugSafetyResult?.riskLevel, rxNormResult?.riskLevel];
    const best = candidates.reduce((acc, cur) => {
      return riskPriority(cur) > riskPriority(acc) ? cur : acc;
    }, null);
    return best || 'Moderate';
  };

  const result = {
    ...drugSafetyResult,
    warnings: Array.from(new Set(normalizedWarnings)),
    interactions: combinedInteractions,
    recommendations: combinedRecommendations,
    rxNorm: rxNormResult,
    riskLevel: pickRiskLevel(),
    safe: drugSafetyResult.safe !== false && rxNormResult.safe !== false,
    status: 'completed'
  };

  console.log('[aiWorkflowService] Drug safety result', {
    consultationId: consultation?._id?.toString?.(),
    patientId: patientObj._id || patientObj.id || null,
    result
  });

  return result;
};

export const runPatientContextWorker = async ({ patient, consultations, reports, patientFileSummaries }) => {
  const patientObj = normalizePatient(patient);
  return generatePatientBrief({
    patient: patientObj,
    recentConsultations: Array.isArray(consultations) ? consultations : [],
    reports: Array.isArray(reports) ? reports : [],
    patientFiles: patientFileSummaries || []
  });
};

export const runFollowupWorker = async ({ consultation, patient, transcription }) => {
  const followUpDays = Number(transcription.analysis?.follow_up_days || 7);
  const followUpReason = transcription.analysis?.follow_up || 'Routine follow-up after consultation';
  const followUpDate = new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000);

  return {
    followUpDays,
    followUpReason,
    followUpDate
  };
};

export const runAnalyticsWorker = async ({ consultation, transcription, task }) => {
  setImmediate(async () => {
    try {
      await recordConsultationAnalytics({ consultation, transcription, task });
    } catch (error) {
      console.error('[aiWorkflowService] Analytics worker failed:', error);
    }
  });
};
