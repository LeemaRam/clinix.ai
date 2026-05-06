import axios from 'axios';
import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { generateSOAPNote as requestSOAPNote } from '../services/pythonService.js';
import { analyzePatientFiles } from '../services/patientFileAnalysisService.js';

export const checkDrugSafety = asyncHandler(async (req, res) => {
  const { new_drugs, existing_drugs, patientFiles, patientInfo } = req.body;
  if (!new_drugs || !Array.isArray(new_drugs)) {
    throw new ApiError(400, 'new_drugs array required');
  }

  let fileSummaries = patientFiles || [];
  if (!fileSummaries.length && req.body.patientId) {
    const patient = await Patient.findOne({ _id: req.body.patientId, doctorId: req.user.id });
    if (patient && patient.uploadedFiles && patient.uploadedFiles.length) {
      fileSummaries = await analyzePatientFiles(patient.uploadedFiles);
    }
  }

  try {
    const result = await axios.post(
      `${env.PYTHON_AI_SERVICE_URL}/drug-safety`,
      {
        medications: new_drugs,
        patient_info: patientInfo || {},
        patient_files: fileSummaries,
        language: 'en'
      }
    );
    res.json({ success: true, data: result.data });
  } catch (e) {
    throw new ApiError(502, 'Drug safety service unavailable');
  }
});

export const getPatientBrief = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }

  // Fetch relevant data including patient files
  const consultations = await Consultation.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const reports = await Report.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  // Analyze uploaded files and include summaries in the patient brief
  const patientFiles = patient.uploadedFiles || [];
  const patientFileSummaries = patientFiles.length ? await analyzePatientFiles(patientFiles) : [];

  // Call AI Service (Agent 3)
  const result = await axios.post(`${env.PYTHON_AI_SERVICE_URL}/patient-brief`, {
    patient: patient.toObject(),
    recentConsultations: consultations,
    reports,
    patient_files: patientFileSummaries
  });

  if (!result.data.success) {
    throw new ApiError(500, result.data.message || 'Failed to generate patient brief');
  }

  res.json({
    success: true,
    message: 'Patient brief generated successfully',
    data: result.data
  });
});

export const generateSOAPNote = asyncHandler(async (req, res) => {
  const { patientId, transcription, consultationReason } = req.body;

  if (!patientId || !transcription) {
    throw new ApiError(400, 'patientId and transcription are required');
  }

  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }

  const result = await requestSOAPNote({
    patient: patient.toObject(),
    transcription,
    consultationReason
  });

  if (!result.success) {
    throw new ApiError(502, result.message || 'Failed to generate SOAP note');
  }

  res.json({
    success: true,
    message: 'SOAP note generated successfully',
    data: result
  });
});