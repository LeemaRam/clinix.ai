<<<<<<< HEAD
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Report } from '../models/Report.js';
import { checkDrugSafety, generatePatientBrief } from './openaiService.js';
=======
import axios from 'axios';
import { env } from '../config/env.js';
import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Report } from '../models/Report.js';

const client = axios.create({ baseURL: env.PYTHON_AI_SERVICE_URL, timeout: 600000 });
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

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

<<<<<<< HEAD
  const drugSafety = await checkDrugSafety({
    medications: consultation.medicalInfo?.medications_mentioned || [],
    patientInfo: patientObj,
    patientFiles: patientFileSummaries || [],
    language: 'en'
  });

  const patientBrief = await generatePatientBrief({
    patient: patientObj,
    recentConsultations: consultations,
    reports,
    patientFiles: patientFileSummaries || []
=======
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
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  });

  patient.briefHistory = patient.briefHistory || [];
  patient.briefHistory.push({
<<<<<<< HEAD
    summary: patientBrief.brief || patientBrief.summary || '',
=======
    summary: patientBrief.data.brief || patientBrief.data.summary || '',
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
    generatedAt: new Date(),
    source: 'Agent 1 Leader',
    patientFiles: patientFileSummaries || []
  });
  await patient.save();

  return {
<<<<<<< HEAD
    drugSafety,
    patientBrief
=======
    drugSafety: drugSafety.data,
    patientBrief: patientBrief.data
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  };
};
