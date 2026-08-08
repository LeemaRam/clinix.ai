import { Patient } from '../models/Patient.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { analyzePatientFiles } from '../services/patientFileAnalysisService.js';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import {
  buildBlobName,
  createStoredFileReadStream,
  deleteStoredFile,
  readStoredFileToBuffer,
  uploadPersistentFile
} from '../services/storage/index.js';

const resolveLegacyPatientFilePath = (storedName) => path.resolve(env.UPLOAD_PATIENT_FILES_DIR, storedName || '');

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

  const localFilePath = file.path;
  const blobName = buildBlobName({
    categoryPrefix: 'patient-files',
    entityId: patientId,
    filename: file.filename || path.basename(localFilePath)
  });
  const persistentFilePath = await uploadPersistentFile({
    localPath: localFilePath,
    localFallbackPath: localFilePath,
    container: env.AZURE_STORAGE_CONTAINER_PATIENT_FILES,
    blobName,
    contentType: file.mimetype
  });

  const fileData = {
    originalName: file.originalname,
    storedName: persistentFilePath,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: req.user.id
  };

  patient.uploadedFiles.push(fileData);
  await patient.save();

  if (persistentFilePath !== localFilePath && fs.existsSync(localFilePath)) {
    fs.unlinkSync(localFilePath);
  }

  const savedFile = patient.uploadedFiles[patient.uploadedFiles.length - 1];
  res.json({ success: true, data: savedFile });
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

  const legacyRelativePath = resolveLegacyPatientFilePath(file.storedName);
  const storagePath = file.storedName;
  let fileBuffer;
  try {
    fileBuffer = await readStoredFileToBuffer({ storagePath, localFallbackPath: legacyRelativePath });
  } catch (error) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${file.originalName || 'file'}"`);
  const { stream } = await createStoredFileReadStream({ storagePath, localFallbackPath: legacyRelativePath, buffer: fileBuffer });
  stream.pipe(res);
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

  const legacyRelativePath = resolveLegacyPatientFilePath(file.storedName);
  const storagePath = file.storedName;
  await deleteStoredFile({ storagePath, localFallbackPath: legacyRelativePath });

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