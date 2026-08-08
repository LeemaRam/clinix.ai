import path from 'path';
import * as pdfParse from 'pdf-parse';
import { readStoredFileToBuffer } from './storage/index.js';

const PATIENT_FILE_DIR = path.resolve('uploads', 'patient_files');

const readPlainText = async (buffer) => {
  return buffer.toString('utf-8');
};

const extractPdfText = async (buffer) => {
  const data = await pdfParse.default(buffer);
  return data.text || '';
};

export const extractPatientFileSummary = async (fileEntry) => {
  const legacyLocalPath = path.join(PATIENT_FILE_DIR, fileEntry.storedName || '');
  const storagePath = fileEntry.storedName;
  const summary = {
    originalName: fileEntry.originalName,
    storedName: fileEntry.storedName,
    mimeType: fileEntry.mimeType,
    size: fileEntry.size,
    uploadedAt: fileEntry.uploadedAt,
    uploadedBy: fileEntry.uploadedBy,
    text: null,
    summary: null,
    error: null
  };

  const dataBuffer = await readStoredFileToBuffer({ storagePath, localFallbackPath: legacyLocalPath });
  if (!dataBuffer) {
    summary.error = 'File missing in storage';
    return summary;
  }

  try {
    if (fileEntry.mimeType === 'application/pdf') {
      const text = await extractPdfText(dataBuffer);
      summary.text = text.trim();
      summary.summary = text.trim().slice(0, 1500);
      return summary;
    }

    if (fileEntry.mimeType.startsWith('text/')) {
      const text = await readPlainText(dataBuffer);
      summary.text = text.trim();
      summary.summary = text.trim().slice(0, 1500);
      return summary;
    }

    if (fileEntry.mimeType.startsWith('image/')) {
      summary.summary = `Image file '${fileEntry.originalName}' of type ${fileEntry.mimeType}. This is a medical scan or image and requires specialist review.`;
      return summary;
    }

    summary.summary = `File '${fileEntry.originalName}' of type ${fileEntry.mimeType} uploaded for patient review.`;
    return summary;
  } catch (error) {
    summary.error = String(error.message || error);
    return summary;
  }
};

export const analyzePatientFiles = async (patientFiles = []) => {
  const results = [];

  for (const fileEntry of patientFiles) {
    const summary = await extractPatientFileSummary(fileEntry);
    results.push(summary);
  }

  return results;
};
