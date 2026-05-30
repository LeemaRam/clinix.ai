import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Report } from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
<<<<<<< HEAD
import { analyzePatientFiles } from '../services/patientFileAnalysisService.js';

import {
  checkDrugSafety as checkDrugSafetyService,
  generatePatientBrief,
  generateSOAPNote as generateSOAPNoteService
} from '../services/openaiService.js';

export const checkDrugSafety = asyncHandler(async (req, res) => {
  const { new_drugs, existing_drugs, patientFiles, patientInfo } = req.body;

=======
import { env } from '../config/env.js';
import { generateSOAPNote as requestSOAPNote } from '../services/pythonService.js';
import { analyzePatientFiles } from '../services/patientFileAnalysisService.js';

export const checkDrugSafety = asyncHandler(async (req, res) => {
  const { new_drugs, existing_drugs, patientFiles, patientInfo } = req.body;
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  if (!new_drugs || !Array.isArray(new_drugs)) {
    throw new ApiError(400, 'new_drugs array required');
  }

  let fileSummaries = patientFiles || [];
<<<<<<< HEAD

  if (!fileSummaries.length && req.body.patientId) {
    const patient = await Patient.findOne({
      _id: req.body.patientId,
      doctorId: req.user.id
    });

=======
  if (!fileSummaries.length && req.body.patientId) {
    const patient = await Patient.findOne({ _id: req.body.patientId, doctorId: req.user.id });
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
    if (patient && patient.uploadedFiles && patient.uploadedFiles.length) {
      fileSummaries = await analyzePatientFiles(patient.uploadedFiles);
    }
  }

  try {
<<<<<<< HEAD
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

=======
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
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
    throw new ApiError(502, 'Drug safety service unavailable');
  }
});

export const getPatientBrief = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

<<<<<<< HEAD
  const patient = await Patient.findOne({
    _id: patientId,
    doctorId: req.user.id
  });

=======
  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }

<<<<<<< HEAD
=======
  // Fetch relevant data including patient files
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  const consultations = await Consultation.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const reports = await Report.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

<<<<<<< HEAD
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
=======
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
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  });
});

export const generateSOAPNote = asyncHandler(async (req, res) => {
  const { patientId, transcription, consultationReason } = req.body;

  if (!patientId || !transcription) {
    throw new ApiError(400, 'patientId and transcription are required');
  }

<<<<<<< HEAD
  const patient = await Patient.findOne({
    _id: patientId,
    doctorId: req.user.id
  });

=======
  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  if (!patient) {
    throw new ApiError(404, 'Patient not found');
  }

<<<<<<< HEAD
  const result = await generateSOAPNoteService({
=======
  const result = await requestSOAPNote({
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
    patient: patient.toObject(),
    transcription,
    consultationReason
  });

<<<<<<< HEAD
  if (!result.soapNote) {
    throw new ApiError(502, 'Failed to generate SOAP note');
=======
  if (!result.success) {
    throw new ApiError(502, result.message || 'Failed to generate SOAP note');
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  }

  res.json({
    success: true,
    message: 'SOAP note generated successfully',
    data: result
  });
});