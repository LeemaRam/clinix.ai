import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Transcription } from '../models/Transcription.js';
import { Report } from '../models/Report.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeConsultation, serializeTranscription } from '../utils/serializers.js';
import { transcribeAudio, generateReport as generateAiReport } from '../services/pythonService.js';
import { extractMedicalAnalysis } from '../services/medicalAnalysisService.js';
import { env } from '../config/env.js';
import { getSocketServer } from '../socket.js';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatDateOnly = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 0;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > dob.getMonth()
    || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());

  if (!hasBirthdayPassed) age -= 1;
  return Math.max(0, age);
};

const normalizeAnalysisArray = (value) => (Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []);

const buildStructuredContent = ({ consultation, transcription, aiReport = null }) => {
  const analysis = transcription.analysis || {};
  const patient = consultation.patientId || {};
  const doctor = consultation.doctorId || {};

  const summaryText = String(
    aiReport?.summary
    || analysis.summary
    || [analysis.subjective, analysis.objective, analysis.assessment].filter(Boolean).join(' ')
    || transcription.rawText
    || ''
  );

  const recommendationsText = Array.isArray(aiReport?.recommendations)
    ? aiReport.recommendations.join('\n')
    : (Array.isArray(analysis?.medical_info?.recommendations)
      ? analysis.medical_info.recommendations.join('\n')
      : String(analysis.plan || ''));

  const subjectiveText = String(analysis.subjective || summaryText || 'No subjective findings documented.');
  const objectiveText = String(analysis.objective || 'No objective findings documented.');
  const assessmentText = String(analysis.assessment || 'No assessment documented.');
  const planText = String(analysis.plan || recommendationsText || 'No plan documented.');

  const consultationTimestamp = consultation.startedAt || consultation.scheduledAt || consultation.createdAt;

  return {
    patient_info: {
      name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      age: calculateAge(patient.dateOfBirth),
      gender: String(patient.gender || ''),
      date_of_birth: formatDateOnly(patient.dateOfBirth),
      consultation_date: formatDateOnly(consultationTimestamp),
      consultation_time: consultationTimestamp ? new Date(consultationTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      doctor_name: String(doctor.fullName || ''),
      doctor_email: String(doctor.email || '')
    },
    sections: {
      title: 'Consultation SOAP Report',
      subjective: subjectiveText,
      objective: objectiveText,
      assessment: assessmentText,
      plan: planText,
      vital_signs: String(analysis.vital_signs || ''),
      neurological_exam: String(analysis.neurological_exam || ''),
      pharmacological_treatment: String(analysis.pharmacological_treatment || ''),
      self_care_measures: String(analysis.self_care_measures || ''),
      dietary_recommendations: String(analysis.dietary_recommendations || ''),
      follow_up: String(analysis.follow_up || ''),
      signature: String(doctor.fullName || '')
    },
    medical_analysis: {
      symptoms: normalizeAnalysisArray(analysis?.medical_info?.symptoms),
      medical_history: normalizeAnalysisArray(analysis?.medical_info?.medical_history),
      current_medications: normalizeAnalysisArray(analysis?.medical_info?.current_medications || analysis.medications_mentioned),
      diagnosis: normalizeAnalysisArray(analysis?.medical_info?.diagnosis),
      treatment_plan: normalizeAnalysisArray(analysis?.medical_info?.treatment_plan),
      follow_up: normalizeAnalysisArray(analysis?.medical_info?.follow_up)
    },
    summary: summaryText,
    transcription_confidence: Number(transcription.confidenceScore || 0),
    transcription_duration: Number(transcription.duration || 0)
  };
};

const makePdf = async ({ title, body, outputPath }) =>
  new Promise((resolve, reject) => {
    ensureDir(path.dirname(outputPath));
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    doc.fontSize(18).text(title);
    doc.moveDown();
    doc.fontSize(11).text(body || 'No content available');
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

const buildStructuredPreview = ({ consultation, transcription }) => {
  return {
    preview_id: consultation._id.toString(),
    structured_content: buildStructuredContent({ consultation, transcription })
  };
};

const buildSoapSections = (analysis = {}) => {
  return {
    subjective: String(analysis.subjective || 'No subjective findings documented.'),
    objective: String(analysis.objective || 'No objective findings documented.'),
    assessment: String(analysis.assessment || 'No assessment documented.'),
    plan: String(analysis.plan || 'No plan documented.'),
    medicationsMentioned: Array.isArray(analysis.medications_mentioned)
      ? analysis.medications_mentioned.map((item) => String(item)).filter(Boolean)
      : [],
    followUpDays: Number.isFinite(Number(analysis.follow_up_days))
      ? Number(analysis.follow_up_days)
      : 7
  };
};

const shouldIncludeRawTranscript = (analysis = {}) => {
  const assessment = String(analysis.assessment || '').toLowerCase();
  const plan = String(analysis.plan || '').toLowerCase();
  return assessment.includes('ai analysis unavailable') || plan.includes('configure gemini_api_key');
};

const createAndStreamReportPdf = async ({ consultation, transcription, doctorId, generatedBy, res, previewId }) => {
  const patientName = consultation.patientId ? `${consultation.patientId.firstName} ${consultation.patientId.lastName}` : 'Unknown Patient';
  const soap = buildSoapSections(transcription.analysis || {});
  const medicationsText = soap.medicationsMentioned.length > 0 ? soap.medicationsMentioned.join(', ') : 'None documented';

  const body = [
    `Patient: ${patientName}`,
    `Consultation Type: ${consultation.consultationType}`,
    `Status: ${consultation.status}`,
    '',
    'Subjective:',
    soap.subjective,
    '',
    'Objective:',
    soap.objective,
    '',
    'Assessment:',
    soap.assessment,
    '',
    'Plan:',
    soap.plan,
    '',
    `Medications Mentioned: ${medicationsText}`,
    `Follow-up: ${soap.followUpDays} day(s)`
  ].join('\n');

  const transcriptReference = shouldIncludeRawTranscript(transcription.analysis || {})
    ? `\n\nTranscript (fallback reference):\n${transcription.rawText || ''}`
    : '';

  const fullBody = `${body}${transcriptReference}`;

  const reportsDir = path.resolve(env.UPLOAD_REPORTS_DIR);
  const filename = `consultation-report-${consultation._id}-${Date.now()}.pdf`;
  const outputPath = path.join(reportsDir, filename);
  await makePdf({ title: 'Consultation SOAP Report', body: fullBody, outputPath });

  const report = await Report.create({
    consultationId: consultation._id,
    patientId: consultation.patientId?._id,
    doctorId,
    content: fullBody,
    format: 'PDF',
    status: 'generated',
    filePath: outputPath,
    generatedBy: generatedBy || 'System'
  });

  const io = getSocketServer();
  if (io) {
    const payload = {
      consultationId: consultation._id.toString(),
      reportId: report._id.toString(),
      previewId: previewId || null
    };
    io.to(`consultation:${consultation._id.toString()}`).emit('report_generation_completed', payload);
    io.emit('report_generation_completed', payload);
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(report.filePath).pipe(res);
};

export const createConsultation = asyncHandler(async (req, res) => {
  const { patient_id, consultation_type, recording_type, consent_obtained } = req.body;

  const patient = await Patient.findOne({ _id: patient_id, doctorId: req.user.id });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const consultation = await Consultation.create({
    patientId: patient_id,
    doctorId: req.user.id,
    consultationType: consultation_type || 'general',
    recordingType: recording_type || 'upload',
    consentObtained: Boolean(consent_obtained),
    consentTimestamp: consent_obtained ? new Date() : null,
    status: 'scheduled',
    scheduledAt: new Date()
  });

  const data = { consultation: serializeConsultation(consultation) };
  res.status(201).json({ success: true, data, ...data });
});

export const uploadAudio = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.id, doctorId: req.user.id });
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });
  if (!req.file) return res.status(400).json({ success: false, error: 'Audio file is required' });

  consultation.audioFilePath = req.file.path;
  consultation.audioFileSize = req.file.size;
  consultation.audioFormat = req.file.mimetype;
  consultation.status = 'recorded';
  consultation.startedAt = consultation.startedAt || new Date();
  await consultation.save();

  const speechLanguage = String(req.body.speech_language || 'en').toLowerCase().startsWith('ur') ? 'ur' : 'en';

  let transcription = await Transcription.findOne({ consultationId: consultation._id });
  if (!transcription) {
    transcription = await Transcription.create({
      consultationId: consultation._id,
      doctorId: req.user.id,
      audioFilePath: consultation.audioFilePath,
      status: 'processing',
      speechLanguage,
      startedAt: new Date()
    });
  }

  const io = getSocketServer();
  const consultationRoomId = consultation._id.toString();

  if (io) {
    const payload = { consultationId: consultationRoomId, progress: 10, status: 'processing' };
    io.to(`consultation:${consultationRoomId}`).emit('transcription_progress', payload);
    io.emit('transcription_progress', payload);
  }

  try {
    if (env.DEMO_MODE && io) {
      await delay(300);
      const payload = { consultationId: consultationRoomId, progress: 50, status: 'processing' };
      io.to(`consultation:${consultationRoomId}`).emit('transcription_progress', payload);
      io.emit('transcription_progress', payload);
    }

    const aiResult = await transcribeAudio({
      audioFilePath: consultation.audioFilePath,
      speechLanguage,
      consultationId: consultation._id.toString(),
      mimeType: consultation.audioFormat
    });

    if (io && !env.DEMO_MODE) {
      const payload = { consultationId: consultationRoomId, progress: 80, status: 'finalizing' };
      io.to(`consultation:${consultationRoomId}`).emit('transcription_progress', payload);
      io.emit('transcription_progress', payload);
    }

    transcription.status = 'completed';
    transcription.rawText = aiResult.transcript || aiResult.raw_text || '';
    transcription.segments = aiResult.segments || [];
    transcription.confidenceScore = aiResult.confidence_score || 0;
    transcription.duration = aiResult.duration || 0;
    transcription.language = aiResult.language || speechLanguage;
    transcription.modelUsed = aiResult.model_used || transcription.modelUsed;
    transcription.analysis = await extractMedicalAnalysis(transcription.rawText);
    transcription.completedAt = new Date();
    await transcription.save();

    consultation.status = 'transcribed';
    consultation.endedAt = new Date();
    consultation.languageDetected = transcription.language;
    consultation.consultationSummary = [transcription.analysis?.subjective, transcription.analysis?.assessment]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 1000);
    consultation.medicalInfo = {
      medications_mentioned: transcription.analysis?.medications_mentioned || [],
      follow_up_days: transcription.analysis?.follow_up_days || 7,
      soap: transcription.analysis || {}
    };
    await consultation.save();

    if (io) {
      const payload = { consultationId: consultationRoomId, progress: 100, status: 'completed' };
      io.to(`consultation:${consultationRoomId}`).emit('transcription_progress', payload);
      io.emit('transcription_progress', payload);
    }

    const data = { consultation: serializeConsultation(consultation), transcription: serializeTranscription(transcription) };
    return res.json({ success: true, data, ...data });
  } catch (e) {
    transcription.status = 'failed';
    transcription.errorMessage = e.message;
    await transcription.save();

    consultation.status = 'failed';
    await consultation.save();

    if (io) {
      const payload = { consultationId: consultationRoomId, progress: 100, status: 'failed' };
      io.to(`consultation:${consultationRoomId}`).emit('transcription_progress', payload);
      io.emit('transcription_progress', payload);
    }

    return res.status(502).json({ success: false, error: e.message, fallback: false, details: e.message });
  }
});

export const listConsultations = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);

  const [consultations, total] = await Promise.all([
    Consultation.find({ doctorId: req.user.id })
      .populate('patientId')
      .populate('doctorId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Consultation.countDocuments({ doctorId: req.user.id })
  ]);

  const data = {
    consultations: consultations.map(serializeConsultation),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };

  res.json({ success: true, data, ...data });
});

export const deleteConsultation = asyncHandler(async (req, res) => {
  const c = await Consultation.findOneAndDelete({ _id: req.params.id, doctorId: req.user.id });
  if (!c) return res.status(404).json({ success: false, error: 'Consultation not found' });
  await Transcription.deleteMany({ consultationId: c._id });
  await Report.deleteMany({ consultationId: c._id });
  res.json({ success: true });
});

export const getTranscriptionByConsultation = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id });
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });
  const data = { transcription: serializeTranscription(t) };
  res.json({ success: true, data, ...data });
});

export const patchTranscriptionSegment = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id });
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  const segmentId = Number(req.params.segmentId);
  const target = t.segments.find((s) => Number(s.id) === segmentId);
  if (!target) return res.status(404).json({ success: false, error: 'Segment not found' });

  target.text = req.body.text || target.text;
  target.updatedBy = req.user.id;
  await t.save();

  const data = { transcription: serializeTranscription(t) };
  res.json({ success: true, data, ...data });
});

export const generateReportPreview = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id })
    .populate('patientId')
    .populate('doctorId');
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  let ai = null;
  try {
    ai = await generateAiReport({ transcriptionText: t.rawText, consultationType: consultation.consultationType, language: 'en' });
  } catch (error) {
    console.warn('[generateReportPreview] AI report generation failed, continuing with transcription analysis fallback.', error?.message || error);
  }

  const structured_content = buildStructuredContent({ consultation, transcription: t, aiReport: ai });

  const data = { preview_id: consultation._id.toString(), structured_content };
  res.json({ success: true, data, ...data });
});

export const updateReportPreview = asyncHandler(async (req, res) => {
  const data = { structured_content: req.body.structured_content };
  res.json({ success: true, data, ...data });
});

export const generateConsultationReportPdf = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id }).populate('patientId');
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  const io = getSocketServer();
  if (io) {
    const payload = { consultationId: consultation._id.toString(), previewId: null };
    io.to(`consultation:${consultation._id.toString()}`).emit('report_generation_started', payload);
    io.emit('report_generation_started', payload);
  }

  await createAndStreamReportPdf({
    consultation,
    transcription: t,
    doctorId: req.user.id,
    generatedBy: req.body.generatedBy,
    res,
    previewId: null
  });
});

export const generateConsultationReportPreviewPdf = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id }).populate('patientId');
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  // Current preview implementation uses consultation id as preview id.
  const previewData = buildStructuredPreview({ consultation, transcription: t });
  if (req.params.previewId !== previewData.preview_id) {
    return res.status(404).json({ success: false, error: 'Report preview not found' });
  }

  const io = getSocketServer();
  if (io) {
    const payload = { consultationId: consultation._id.toString(), previewId: req.params.previewId };
    io.to(`consultation:${consultation._id.toString()}`).emit('report_generation_started', payload);
    io.emit('report_generation_started', payload);
  }

  await createAndStreamReportPdf({
    consultation,
    transcription: t,
    doctorId: req.user.id,
    generatedBy: req.body.generatedBy,
    res,
    previewId: req.params.previewId
  });
});
