import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Transcription } from '../models/Transcription.js';
import { Report } from '../models/Report.js';
import { Appointment } from '../models/Appointment.js';
import { AiTask } from '../models/AiTask.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { serializeConsultation, serializeTranscription } from '../utils/serializers.js';
import { formatSOAP, formatSoapText } from '../services/soapFormatter.js';
import { env } from '../config/env.js';
import { getSocketServer } from '../socket.js';
import { createAiTask, processConsultationAiTask } from '../services/aiTaskService.js';
import { sendAppointmentInvitation, getDoctorName } from '../services/followupInvitationService.js';
import { validateEnum, collectErrors, throwIfErrors } from '../utils/validation.js';
import {
  buildBlobName,
  deleteStoredFile,
  uploadPersistentFile
} from '../services/storage/index.js';

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

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

const normalizeDrugSafetyList = (value) => {
  if (!value && value !== 0) return [];
  // If already an array, normalize each element
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item && item !== 0) return null;
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object') {
          // Prefer readable fields if present
          const parts = [];
          if (item.drugs) parts.push(Array.isArray(item.drugs) ? item.drugs.join(', ') : String(item.drugs));
          if (item.description) parts.push(String(item.description));
          if (item.severity) parts.push(String(item.severity));
          if (parts.length > 0) return parts.join(' — ');
          try {
            return JSON.stringify(item);
          } catch (err) {
            return String(item);
          }
        }
        return String(item);
      })
      .filter(Boolean);
  }

  // If it's a string, split by newlines or semicolons or periods
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|;|\.|\u2022|\|/) // common separators
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Fallback: coerce to string
  return [String(value)].filter(Boolean);
};

const buildStructuredContent = ({ consultation, transcription, aiReport = null }) => {
  const analysis = transcription.analysis || {};
  const patient = consultation.patientId || {};
  const doctor = consultation.doctorId || {};
  const _rawDrugSafety = aiReport?.drugSafety ?? aiReport?.drug_safety ?? null;
  let drugSafety = _rawDrugSafety;

  if (!drugSafety) {
    const meds = Array.isArray(transcription.analysis?.medications_mentioned)
      ? transcription.analysis.medications_mentioned
      : [];
    if (meds.length > 0) {
      drugSafety = {
        warnings: [],
        interactions: [],
        recommendations: [`Drug safety assessment not yet available for medications: ${meds.join(', ')}`],
        safe: false
      };
    } else {
      drugSafety = { warnings: [], interactions: [], recommendations: [], safe: true };
    }
  }

  if (typeof drugSafety === 'string') {
    try {
      const parsed = JSON.parse(drugSafety);
      if (parsed && typeof parsed === 'object') drugSafety = parsed;
    } catch (err) {
      // if parse fails, keep original string (normalizeAnalysisArray will handle)
    }
  }

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
    drug_safety: {
      warnings: normalizeDrugSafetyList(drugSafety?.warnings),
      interactions: normalizeDrugSafetyList(drugSafety?.interactions),
      recommendations: normalizeDrugSafetyList(drugSafety?.recommendations),
      safe: drugSafety?.safe !== false,
      riskLevel: drugSafety?.riskLevel ?? undefined,
      rxNorm: drugSafety?.rxNorm ?? undefined
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
    if (content.followUpDays && Number(content.followUpDays) > 0) {
      renderPdfMetaRow(doc, 'Follow-up', `${content.followUpDays} days`);
    }
    doc.moveDown(0.5);

    if (content.subjective?.trim()) renderPdfSection(doc, 'Subjective', content.subjective);
    if (content.objective?.trim()) renderPdfSection(doc, 'Objective', content.objective);
    if (content.assessment?.trim()) renderPdfSection(doc, 'Assessment', content.assessment);
    if (content.plan?.trim()) renderPdfSection(doc, 'Plan', content.plan);
    if (Array.isArray(content.medications) && content.medications.length > 0) {
      renderPdfList(doc, 'Medications', content.medications);
    }
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

const buildStructuredPreview = ({ consultation, transcription, aiReport = null }) => {
  return {
    preview_id: consultation._id.toString(),
    structured_content: buildStructuredContent({ consultation, transcription, aiReport })
  };
};

const buildFollowUpReason = (structuredContent) => {
  if (!structuredContent) return 'Routine follow-up after consultation';
  const followUpDetails = [];
  if (Array.isArray(structuredContent.medical_analysis?.follow_up) && structuredContent.medical_analysis.follow_up.length > 0) {
    followUpDetails.push(structuredContent.medical_analysis.follow_up.join(' '));
  }
  if (structuredContent.sections?.follow_up) {
    followUpDetails.push(structuredContent.sections.follow_up);
  }
  if (structuredContent.summary) {
    followUpDetails.push(structuredContent.summary);
  }
  const reason = followUpDetails.filter(Boolean).join(' ').trim();
  return reason || 'Routine follow-up after consultation';
};

const createOrUpdateAppointmentForReport = async ({ consultation, patient, structuredContent }) => {
  const appointmentDays = Number(structuredContent?.follow_up_days ?? 7) || 7;
  const appointmentReason = buildFollowUpReason(structuredContent);
  const appointmentDate = new Date(Date.now() + appointmentDays * 24 * 60 * 60 * 1000);
  const patientPhone = patient?.phone || consultation.patientPhone || '';
  const patientName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';
  const preferredDate = appointmentDate.toISOString().slice(0, 10);
  const doctorId = consultation.doctorId?._id || consultation.doctorId;

  let appointment = await Appointment.findOne({ consultationId: consultation._id });
  if (appointment) {
    let shouldSave = false;

    if (appointment.reason !== appointmentReason) {
      appointment.reason = appointmentReason;
      shouldSave = true;
    }

    if (appointment.preferredDate !== preferredDate) {
      appointment.preferredDate = preferredDate;
      appointment.status = 'pending';
      appointment.invitationSent = false;
      shouldSave = true;
    }

    if (patientPhone && appointment.patientPhone !== patientPhone) {
      appointment.patientPhone = patientPhone;
      shouldSave = true;
    }

    if (appointment.patientName !== patientName) {
      appointment.patientName = patientName;
      shouldSave = true;
    }

    if (shouldSave) {
      await appointment.save();
    }
  } else {
    if (!patientPhone) {
      console.warn('[consultationController] Skipping appointment creation: patient phone is missing', {
        consultationId: consultation._id.toString()
      });
      return null;
    }

    appointment = new Appointment({
      consultationId: consultation._id,
      patientId: consultation.patientId?._id || consultation.patientId,
      patientName,
      patientPhone,
      preferredDate,
      reason: appointmentReason,
      doctorId
    });
    await appointment.save();
  }

  if (patientPhone && !appointment.invitationSent && appointment.status === 'pending') {
    try {
      const doctorName = await getDoctorName(consultation.doctorId);
      await sendAppointmentInvitation({
        appointmentId: appointment._id,
        patientName,
        patientPhone,
        doctorName,
        appointmentDate: appointment.preferredDate
      });
    } catch (error) {
      console.error('[consultationController] appointment invitation failed:', error);
    }
  }

  return appointment;
};

const createAndStreamReportPdf = async ({ consultation, transcription, doctorId, generatedBy, res, previewId, aiReport = null, structuredContentOverride = null }) => {
  const structuredContent = structuredContentOverride || buildStructuredContent({ consultation, transcription, aiReport });
  const patientName = structuredContent.patient_info.name || 'Unknown Patient';
  const consultationDate = structuredContent.patient_info.consultation_date || formatDateOnly(consultation.startedAt || consultation.scheduledAt || consultation.createdAt);
  const doctorName = structuredContent.patient_info.doctor_name || 'Unknown Doctor';
  const medications = Array.isArray(structuredContent.medical_analysis?.current_medications) && structuredContent.medical_analysis.current_medications.length > 0
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
      medications
    },
    outputPath
  });

  const reportBlobName = buildBlobName({
    categoryPrefix: 'reports',
    entityId: consultation._id.toString(),
    filename
  });
  const persistentReportPath = await uploadPersistentFile({
    localPath: outputPath,
    localFallbackPath: outputPath,
    container: env.AZURE_STORAGE_CONTAINER_REPORTS,
    blobName: reportBlobName,
    contentType: 'application/pdf'
  });

  const report = await Report.create({
    consultationId: consultation._id,
    patientId: consultation.patientId?._id,
    doctorId,
    content: JSON.stringify(structuredContent),
    format: 'PDF',
    status: 'generated',
    filePath: persistentReportPath,
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
  const stream = fs.createReadStream(outputPath);
  stream.on('close', async () => {
    if (persistentReportPath !== outputPath) {
      await deleteStoredFile({ storagePath: outputPath });
    }
  });
  stream.pipe(res);
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
  const { patient_id, consultation_type, recording_type, consent_obtained } = req.body || {};

  const errors = collectErrors([
    ['patient_id', patient_id ? null : 'Patient is required'],
    ['recording_type', recording_type ? validateEnum(recording_type, ['doctor_only', 'doctor_patient', 'upload'], { label: 'Recording type' }) : null],
    ['consent_obtained', consent_obtained === true || consent_obtained === 'true' ? null : 'Patient consent is required']
  ]);
  throwIfErrors(errors);

  const patient = await Patient.findOne({ _id: patient_id, doctorId: req.user.id });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const consultation = await Consultation.create({
    patientId: patient_id,
    doctorId: req.user.id,
    consultationType: consultation_type || 'general',
    recordingType: recording_type || 'upload',
    consentObtained: true,
    consentTimestamp: new Date(),
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

  const localAudioPath = req.file.path;
  const blobName = buildBlobName({
    categoryPrefix: 'audio',
    entityId: consultation._id.toString(),
    filename: req.file.filename || path.basename(localAudioPath)
  });
  const persistentAudioPath = await uploadPersistentFile({
    localPath: localAudioPath,
    localFallbackPath: localAudioPath,
    container: env.AZURE_STORAGE_CONTAINER_AUDIO,
    blobName,
    contentType: req.file.mimetype
  });

  consultation.audioFilePath = persistentAudioPath;
  consultation.audioFileSize = req.file.size;
  consultation.audioFormat = req.file.mimetype;
  consultation.status = 'in_progress';
  consultation.startedAt = consultation.startedAt || new Date();
  const fileStats = fs.statSync(localAudioPath);
  const actualSize = fileStats.size;
  if (actualSize !== req.file.size) {
    console.warn('[consultationController] backend persisted audio size mismatch', {
      consultationId: consultation._id.toString(),
      expectedSize: req.file.size,
      actualSize,
      audioPath: localAudioPath
    });
  }
  await consultation.save();

  if (persistentAudioPath !== localAudioPath && fs.existsSync(localAudioPath)) {
    fs.unlinkSync(localAudioPath);
  }

  const speechLanguage = String(req.body.speech_language || 'en').toLowerCase().startsWith('ur') ? 'ur' : 'en';
  console.log('[consultationController] Uploaded audio saved for transcription', {
    consultationId: consultation._id.toString(),
    audioPath: consultation.audioFilePath,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    actualSize,
    speechLanguage
  });

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
  } else {
    transcription.audioFilePath = consultation.audioFilePath;
    transcription.status = 'processing';
    transcription.speechLanguage = speechLanguage;
    transcription.rawText = '';
    transcription.segments = [];
    transcription.confidenceScore = 0;
    transcription.duration = 0;
    transcription.analysis = {};
    transcription.errorMessage = '';
    transcription.startedAt = new Date();
    transcription.completedAt = undefined;
    await transcription.save();
  }

  const task = await createAiTask({
    consultationId: consultation._id,
    patientId: consultation.patientId,
    doctorId: req.user.id
  });

  const io = getSocketServer();
  const consultationRoomId = consultation._id.toString();
  const initialPayload = {
    consultationId: consultationRoomId,
    progress: 5,
    status: 'queued',
    currentStep: 'queued',
    taskId: task._id.toString()
  };

  if (io) {
    io.to(`consultation:${consultationRoomId}`).emit('transcription_progress', initialPayload);
    io.emit('transcription_progress', initialPayload);
  }

  void processConsultationAiTask(task._id).catch((backgroundError) => {
    console.error('[consultationController] Background AI task failed:', backgroundError);
  });

  const data = {
    consultation: serializeConsultation(consultation),
    transcription: serializeTranscription(transcription),
    task: {
      id: task._id.toString(),
      status: task.status,
      progress: task.progress
    }
  };

  return res.json({ success: true, data, ...data });
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
  console.log('[consultationController] Returning transcription response', {
    consultationId: consultation._id.toString(),
    transcriptionId: t._id.toString(),
    rawTextLength: t.rawText?.length || 0,
    duration: t.duration || 0
  });
  const data = { transcription: serializeTranscription(t) };
  res.json({ success: true, data, ...data });
});

export const getAiTaskByConsultation = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id });
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const task = await AiTask.findOne({ consultationId: consultation._id }).sort({ updatedAt: -1 });
  const data = { task: task ? task.toObject() : null };
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

  const task = await AiTask.findOne({ consultationId: consultation._id }).sort({ updatedAt: -1 });
  const structured_content = buildStructuredContent({ consultation, transcription: t, aiReport: task?.result });
  console.log('[consultationController] Report preview payload', {
    consultationId: consultation._id.toString(),
    drugSafety: structured_content.drug_safety,
    previewId: consultation._id.toString()
  });

  const data = { preview_id: consultation._id.toString(), structured_content };
  res.json({ success: true, data, ...data });
});

export const updateReportPreview = asyncHandler(async (req, res) => {
  const data = { structured_content: req.body.structured_content };
  res.json({ success: true, data, ...data });
});

export const saveReportPreview = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id })
    .populate('patientId')
    .populate('doctorId');
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const structuredContent = req.body.structured_content;
  if (!structuredContent || typeof structuredContent !== 'object') {
    return res.status(400).json({ success: false, error: 'Valid structured_content is required' });
  }

  const report = await Report.create({
    consultationId: consultation._id,
    patientId: consultation.patientId?._id,
    doctorId: req.user.id,
    content: JSON.stringify(structuredContent),
    format: 'PDF',
    status: 'saved',
    generatedBy: req.body.generatedBy || req.user.email || 'System'
  });

  try {
    await createOrUpdateAppointmentForReport({ consultation, patient: consultation.patientId, structuredContent });
  } catch (error) {
    // Saving report is primary; appointment invitation should not block this action.
    console.error('[consultationController] Non-blocking appointment sync failed during saveReportPreview:', error);
  }

  const data = { report };
  res.status(201).json({ success: true, data, ...data });
});

export const generateConsultationReportPdf = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id }).populate('patientId');
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  const task = await AiTask.findOne({ consultationId: consultation._id }).sort({ createdAt: -1 });

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
    previewId: null,
    aiReport: task?.result
  });
});

export const generateConsultationReportPreviewPdf = asyncHandler(async (req, res) => {
  const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctorId: req.user.id }).populate('patientId');
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const t = await Transcription.findOne({ consultationId: consultation._id });
  if (!t) return res.status(404).json({ success: false, error: 'Transcription not found' });

  const task = await AiTask.findOne({ consultationId: consultation._id }).sort({ createdAt: -1 });
  const previewData = buildStructuredPreview({ consultation, transcription: t, aiReport: task?.result });
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
    previewId: req.params.previewId,
    aiReport: task?.result,
    structuredContentOverride: req.body.structured_content || null
  });
});
