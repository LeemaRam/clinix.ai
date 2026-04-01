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
import { env } from '../config/env.js';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

  res.status(201).json({ consultation: serializeConsultation(consultation) });
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

  try {
    const aiResult = await transcribeAudio({
      audioFilePath: consultation.audioFilePath,
      speechLanguage,
      consultationId: consultation._id.toString()
    });

    transcription.status = 'completed';
    transcription.rawText = aiResult.raw_text || '';
    transcription.segments = aiResult.segments || [];
    transcription.confidenceScore = aiResult.confidence_score || 0;
    transcription.duration = aiResult.duration || 0;
    transcription.language = aiResult.language || speechLanguage;
    transcription.analysis = aiResult.analysis || {};
    transcription.completedAt = new Date();
    await transcription.save();

    consultation.status = 'transcribed';
    consultation.endedAt = new Date();
    consultation.languageDetected = transcription.language;
    consultation.consultationSummary = transcription.analysis?.summary || '';
    consultation.medicalInfo = transcription.analysis?.medical_info || {};
    await consultation.save();

    return res.json({ success: true, consultation: serializeConsultation(consultation), transcription: serializeTranscription(transcription) });
  } catch (e) {
    transcription.status = 'failed';
    transcription.errorMessage = e.message;
    await transcription.save();

    consultation.status = 'failed';
    await consultation.save();

    return res.status(502).json({ success: false, error: 'Transcription failed', details: e.message });
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

  res.json({
    consultations: consultations.map(serializeConsultation),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
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
  res.json({ transcription: serializeTranscription(t) });
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

  res.json({ transcription: serializeTranscription(t) });
});

export const generateReportPreview = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id });
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  const ai = await generateAiReport({ transcriptionText: t.rawText, consultationType: consultation.consultationType, language: 'en' });

  const structured_content = {
    sections: {
      summary: ai.summary || t.analysis?.summary || '',
      transcript: t.rawText || '',
      recommendations: (ai.recommendations || []).join('\n')
    }
  };

  res.json({ preview_id: consultation._id.toString(), structured_content });
});

export const updateReportPreview = asyncHandler(async (req, res) => {
  res.json({ success: true, structured_content: req.body.structured_content });
});

export const generateConsultationReportPdf = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id }).populate('patientId');
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  const patientName = consultation.patientId ? `${consultation.patientId.firstName} ${consultation.patientId.lastName}` : 'Unknown Patient';
  const body = [
    `Patient: ${patientName}`,
    `Consultation Type: ${consultation.consultationType}`,
    `Status: ${consultation.status}`,
    '',
    'Summary:',
    t.analysis?.summary || '',
    '',
    'Transcript:',
    t.rawText || ''
  ].join('\n');

  const reportsDir = path.resolve(env.UPLOAD_REPORTS_DIR);
  const filename = `consultation-report-${consultation._id}-${Date.now()}.pdf`;
  const outputPath = path.join(reportsDir, filename);
  await makePdf({ title: 'Consultation Report', body, outputPath });

  const report = await Report.create({
    consultationId: consultation._id,
    patientId: consultation.patientId?._id,
    doctorId: req.user.id,
    content: body,
    format: 'PDF',
    status: 'generated',
    filePath: outputPath,
    generatedBy: req.body.generatedBy || 'System'
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  fs.createReadStream(report.filePath).pipe(res);
});
