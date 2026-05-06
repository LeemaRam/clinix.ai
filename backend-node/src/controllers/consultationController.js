import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Transcription } from '../models/Transcription.js';
import { Report } from '../models/Report.js';
import { FollowUp } from '../models/FollowUp.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeConsultation, serializeTranscription } from '../utils/serializers.js';
import { transcribeAudio, generateSOAPNote } from '../services/pythonService.js';
import { extractMedicalAnalysis } from '../services/medicalAnalysisService.js';
import { formatSOAP, formatSoapText } from '../services/soapFormatter.js';
import { env } from '../config/env.js';
import { getSocketServer } from '../socket.js';
import { scheduleFollowUpReminders } from '../services/reminderScheduleService.js';
import { analyzePatientFiles } from '../services/patientFileAnalysisService.js';
import { runAgentLeaderWorkflow } from '../services/agentLeaderService.js';

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
  const soap = formatSOAP({
    subjective: aiReport?.subjective ?? analysis.subjective,
    objective: aiReport?.objective ?? analysis.objective,
    assessment: aiReport?.assessment ?? analysis.assessment,
    plan: aiReport?.plan ?? analysis.plan,
    medications_mentioned: aiReport?.medications_mentioned ?? analysis.medications_mentioned ?? [],
    follow_up_days: aiReport?.follow_up_days ?? analysis.follow_up_days ?? 7
  });

  const summaryText = String(
    aiReport?.summary
    || analysis.summary
    || [soap.subjective, soap.objective, soap.assessment].filter(Boolean).join(' ')
    || transcription.rawText
    || 'No data available'
  );

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
      subjective: soap.subjective,
      objective: soap.objective,
      assessment: soap.assessment,
      plan: soap.plan,
      vital_signs: formatSoapText(analysis.vital_signs, ''),
      neurological_exam: formatSoapText(analysis.neurological_exam, ''),
      pharmacological_treatment: formatSoapText(analysis.pharmacological_treatment, ''),
      self_care_measures: formatSoapText(analysis.self_care_measures, ''),
      dietary_recommendations: formatSoapText(analysis.dietary_recommendations, ''),
      follow_up: formatSoapText(analysis.follow_up, ''),
      signature: String(doctor.fullName || '')
    },
    medical_analysis: {
      symptoms: normalizeAnalysisArray(analysis?.medical_info?.symptoms),
      medical_history: normalizeAnalysisArray(analysis?.medical_info?.medical_history),
      current_medications: normalizeAnalysisArray(analysis?.medical_info?.current_medications || soap.medications_mentioned),
      diagnosis: normalizeAnalysisArray(analysis?.medical_info?.diagnosis),
      treatment_plan: normalizeAnalysisArray(analysis?.medical_info?.treatment_plan),
      follow_up: normalizeAnalysisArray(analysis?.medical_info?.follow_up)
    },
    summary: summaryText,
    transcription_confidence: Number(transcription.confidenceScore || 0),
    transcription_duration: Number(transcription.duration || 0),
    follow_up_days: Number(soap.follow_up_days || analysis.follow_up_days || 7)
  };
};

const renderPdfTitle = (doc, title) => {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827').text(title, { align: 'left' });
  doc.moveDown(0.5);
};

const renderPdfMetaRow = (doc, label, value) => {
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#374151').text(`${label}: `, { continued: true });
  doc.font('Helvetica').fillColor('#111827').text(String(value || 'No data available'));
};

const renderPdfSection = (doc, heading, content) => {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(heading.toUpperCase());
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(11).fillColor('#374151').text(content || 'No data available', {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    align: 'left',
    lineGap: 3
  });
  doc.moveDown(0.4);
};

const renderPdfList = (doc, heading, items) => {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(heading.toUpperCase());
  doc.moveDown(0.2);

  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor('#6b7280').text('No data available', {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      lineGap: 3
    });
  } else {
    list.forEach((item) => {
      doc.font('Helvetica').fontSize(11).fillColor('#374151').text(`• ${item}`, {
        indent: 12,
        continued: false,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 12,
        lineGap: 3
      });
    });
  }
  doc.moveDown(0.4);
};

const makePdf = async ({ content, outputPath }) =>
  new Promise((resolve, reject) => {
    ensureDir(path.dirname(outputPath));
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    renderPdfTitle(doc, content.title || 'Consultation SOAP Report');
    renderPdfMetaRow(doc, 'Patient', content.patientName);
    renderPdfMetaRow(doc, 'Date', content.consultationDate);
    renderPdfMetaRow(doc, 'Doctor', content.doctorName);
    renderPdfMetaRow(doc, 'Follow-up', `${content.followUpDays} days`);
    doc.moveDown(0.5);

    renderPdfSection(doc, 'Subjective', content.subjective);
    renderPdfSection(doc, 'Objective', content.objective);
    renderPdfSection(doc, 'Assessment', content.assessment);
    renderPdfSection(doc, 'Plan', content.plan);
    renderPdfList(doc, 'Medications', content.medications);
    renderPdfList(doc, 'Medical Analysis', content.medicalAnalysis);
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

const createAndStreamReportPdf = async ({ consultation, transcription, doctorId, generatedBy, res, previewId }) => {
  const structuredContent = buildStructuredContent({ consultation, transcription });
  const patientName = structuredContent.patient_info.name || 'Unknown Patient';
  const consultationDate = structuredContent.patient_info.consultation_date || formatDateOnly(consultation.startedAt || consultation.scheduledAt || consultation.createdAt);
  const doctorName = structuredContent.patient_info.doctor_name || 'Unknown Doctor';
  const medications = structuredContent.medical_analysis.current_medications.length > 0
    ? structuredContent.medical_analysis.current_medications
    : structuredContent.sections.pharmacological_treatment
      ? [structuredContent.sections.pharmacological_treatment]
      : [];

  const reportsDir = path.resolve(env.UPLOAD_REPORTS_DIR);
  const filename = `consultation-report-${consultation._id}-${Date.now()}.pdf`;
  const outputPath = path.join(reportsDir, filename);
  await makePdf({
    content: {
      title: 'Consultation SOAP Report',
      patientName,
      consultationDate,
      doctorName,
      followUpDays: structuredContent.follow_up_days || 7,
      subjective: structuredContent.sections.subjective,
      objective: structuredContent.sections.objective,
      assessment: structuredContent.sections.assessment,
      plan: structuredContent.sections.plan,
      medications,
      medicalAnalysis: [
        ...structuredContent.medical_analysis.symptoms.map((item) => `Symptoms: ${item}`),
        ...structuredContent.medical_analysis.medical_history.map((item) => `History: ${item}`),
        ...structuredContent.medical_analysis.diagnosis.map((item) => `Diagnosis: ${item}`),
        ...structuredContent.medical_analysis.treatment_plan.map((item) => `Treatment: ${item}`),
        ...structuredContent.medical_analysis.follow_up.map((item) => `Follow-up: ${item}`)
      ]
    },
    outputPath
  });

  const report = await Report.create({
    consultationId: consultation._id,
    patientId: consultation.patientId?._id,
    doctorId,
    content: JSON.stringify(structuredContent),
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

export const approveSoapNote = asyncHandler(async (req, res) => {
  const { consultationId } = req.params;
  const { approved } = req.body;

  const consultation = await Consultation.findOne({ _id: consultationId, doctorId: req.user.id });
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  if (approved) {
    consultation.soapApprovalStatus = 'approved';
    await consultation.save();

    // Auto-trigger Agent 2: Drug Safety Check
    try {
      const medications = consultation.medicalInfo?.medications_mentioned || [];
      if (medications.length > 0) {
        await axios.post(`${env.PYTHON_AI_SERVICE_URL}/drug-check`, {
          new_drugs: medications,
          existing_drugs: []
        });
        consultation.drugCheckStatus = 'completed';
        await consultation.save();
      }
    } catch (drugCheckError) {
      console.error('Auto drug check failed:', drugCheckError);
      consultation.drugCheckStatus = 'pending';
      await consultation.save();
    }

    res.json({ success: true, message: 'SOAP approved. Drug safety check initiated.' });
  } else {
    consultation.soapApprovalStatus = 'rejected';
    await consultation.save();
    res.json({ success: true, message: 'SOAP rejected.' });
  }
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

    let soapNoteText = '';
    try {
      const patient = await Patient.findById(consultation.patientId);
      if (patient) {
        const soapResult = await generateSOAPNote({
          patient: patient.toObject(),
          transcription: transcription.rawText,
          consultationReason: consultation.consultationType
        });

        soapNoteText = String(soapResult?.data?.soapNote || soapResult?.soapNote || '').trim();
        if (soapNoteText) {
          transcription.analysis.soap_note = soapNoteText;
        }
      }
    } catch (soapError) {
      console.error('[consultationController] SOAP note generation failed:', soapError?.message || soapError);
      transcription.analysis.soap_note_error = String(soapError?.message || soapError || 'SOAP note generation failed');
    }

    transcription.completedAt = new Date();
    await transcription.save();

    consultation.status = 'transcribed';
    consultation.endedAt = new Date();
    consultation.languageDetected = transcription.language;
    consultation.consultationSummary = [transcription.analysis?.subjective, transcription.analysis?.assessment, soapNoteText]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 1000);
    consultation.medicalInfo = {
      medications_mentioned: transcription.analysis?.medications_mentioned || [],
      follow_up_days: transcription.analysis?.follow_up_days || 7,
      soap: {
        ...transcription.analysis,
        note: soapNoteText
      }
    };
    consultation.soapApprovalStatus = 'pending';
    await consultation.save();

    // Auto-schedule follow-up with reminder system
    try {
      const followUpDays = transcription.analysis?.follow_up_days || 7;
      const followUpDate = new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000);
      const followUpReason = transcription.analysis?.follow_up || 'Routine follow-up after consultation';

      const followUp = new FollowUp({
        consultationId: consultation._id,
        patientId: consultation.patientId,
        doctorId: consultation.doctorId,
        followUpDate,
        followUpReason,
        patientPhone: patient.phone // assuming patient is fetched earlier
      });
      await followUp.save();
      
      // Schedule reminders (day before, day of, during appointment)
      await scheduleFollowUpReminders(followUp._id);
      console.log('Follow-up scheduled automatically with reminders');
    } catch (followUpError) {
      console.error('Failed to schedule follow-up:', followUpError);
    }

    try {
      const patientFileSummaries = patient.uploadedFiles && patient.uploadedFiles.length
        ? await analyzePatientFiles(patient.uploadedFiles)
        : [];

      await runAgentLeaderWorkflow({
        consultation,
        patient,
        patientFileSummaries
      });
    } catch (leaderError) {
      console.error('Agent Leader workflow failed:', leaderError?.message || leaderError);
    }

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

  const structured_content = buildStructuredContent({ consultation, transcription: t });

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
