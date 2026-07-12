import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { analyzePatientFiles } from '../services/patientFileAnalysisService.js';

import {
  checkDrugSafety as checkDrugSafetyService,
  generatePatientBrief,
  generateSOAPNote as generateSOAPNoteService
} from '../services/openaiService.js';

export const checkDrugSafety = asyncHandler(async (req, res) => {
  const { new_drugs, existing_drugs, patientFiles, patientInfo } = req.body;

  if (!new_drugs || !Array.isArray(new_drugs)) {
    throw new ApiError(400, 'new_drugs array required');
  }

  let fileSummaries = patientFiles || [];

  if (!fileSummaries.length && req.body.patientId) {
    const patient = await Patient.findOne({
      _id: req.body.patientId,
      doctorId: req.user.id
    });

    if (patient && patient.uploadedFiles && patient.uploadedFiles.length) {
      fileSummaries = await analyzePatientFiles(patient.uploadedFiles);
    }
  }

  try {
    const result = await checkDrugSafetyService({
      medications: new_drugs,
      existing_drugs: existing_drugs || [],
      patientInfo: patientInfo || {},
      patientFiles: fileSummaries,
      language: 'en'
    });

    res.json({
      success: true,
      data: result
    });

  } catch (e) {
    console.error('[agentController] Drug safety error:', e);

    throw new ApiError(502, 'Drug safety service unavailable');
  }
});

export const getPatientBrief = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const patient = await Patient.findOne({
    _id: patientId,
    doctorId: req.user.id
  });

  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }

  const consultations = await Consultation.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const reports = await Report.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const patientFiles = patient.uploadedFiles || [];

  const patientFileSummaries = patientFiles.length
    ? await analyzePatientFiles(patientFiles)
    : [];

  const result = await generatePatientBrief({
    patient: patient.toObject(),
    recentConsultations: consultations,
    reports,
    patientFiles: patientFileSummaries
  });

  res.json({
    success: true,
    message: 'Patient brief generated successfully',
    data: result
  });
});

export const generateSOAPNote = asyncHandler(async (req, res) => {
  const { patientId, transcription, consultationReason } = req.body;

  if (!patientId || !transcription) {
    throw new ApiError(400, 'patientId and transcription are required');
  }

  const patient = await Patient.findOne({
    _id: patientId,
    doctorId: req.user.id
  });

  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }

  const result = await generateSOAPNoteService({
    patient: patient.toObject(),
    transcription,
    consultationReason
  });

  if (!result.soapNote) {
    throw new ApiError(502, 'Failed to generate SOAP note');
  }

  res.json({
    success: true,
    message: 'SOAP note generated successfully',
    data: result
  });
});