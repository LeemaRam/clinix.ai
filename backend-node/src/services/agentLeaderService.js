import axios from 'axios';
import { env } from '../config/env.js';
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Report } from '../models/Report.js';

const client = axios.create({ baseURL: env.PYTHON_AI_SERVICE_URL, timeout: 600000 });

export const runAgentLeaderWorkflow = async ({ consultation, patient, patientFileSummaries }) => {
  const patientObj = patient.toObject ? patient.toObject() : patient;

  const consultations = await Consultation.find({ patientId: patient._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const reports = await Report.find({ patientId: patient._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const drugSafety = await client.post('/drug-safety', {
    medications: consultation.medicalInfo?.medications_mentioned || [],
    patient_info: patientObj,
    patient_files: patientFileSummaries || [],
    language: 'en'
  });

  const patientBrief = await client.post('/patient-brief', {
    patient: patientObj,
    recentConsultations: consultations,
    reports,
    patient_files: patientFileSummaries || []
  });

  patient.briefHistory = patient.briefHistory || [];
  patient.briefHistory.push({
    summary: patientBrief.data.brief || patientBrief.data.summary || '',
    generatedAt: new Date(),
    source: 'Agent 1 Leader',
    patientFiles: patientFileSummaries || []
  });
  await patient.save();

  return {
    drugSafety: drugSafety.data,
    patientBrief: patientBrief.data
  };
};
