import { Patient } from '../models/Patient.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { analyzePatientFiles } from '../services/patientFileAnalysisService.js';
import fs from 'fs';
import path from 'path';

export const uploadPatientFile = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  const fileData = {
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: req.user.id
  };

  patient.uploadedFiles.push(fileData);
  await patient.save();

  res.json({ success: true, data: fileData });
});

export const listPatientFiles = asyncHandler(async (req, res) => {
  const { patientId } = req.params;

  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id })
    .select('uploadedFiles')
    .populate('uploadedFiles.uploadedBy', 'firstName lastName');

  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  res.json({ success: true, data: patient.uploadedFiles });
});

export const downloadPatientFile = asyncHandler(async (req, res) => {
  const { patientId, fileId } = req.params;

  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  const file = patient.uploadedFiles.id(fileId);
  if (!file) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  const filePath = path.join('uploads', 'patient_files', file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'File not found on disk' });
  }

  res.download(filePath, file.originalName);
});

export const deletePatientFile = asyncHandler(async (req, res) => {
  const { patientId, fileId } = req.params;

  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  const file = patient.uploadedFiles.id(fileId);
  if (!file) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  const filePath = path.join('uploads', 'patient_files', file.storedName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  file.remove();
  await patient.save();

  res.json({ success: true, data: { deleted: true } });
});

export const analyzeUploadedPatientFiles = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const patient = await Patient.findOne({ _id: patientId, doctorId: req.user.id });
  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  if (!patient.uploadedFiles || !patient.uploadedFiles.length) {
    return res.json({ success: true, data: [] });
  }

  const summaries = await analyzePatientFiles(patient.uploadedFiles);
  res.json({ success: true, data: summaries });
});