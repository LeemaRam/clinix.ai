import { Consultation } from '../models/Consultation.js';
import { Patient } from '../models/Patient.js';
import { Report } from '../models/Report.js';
import { checkDrugSafety, generatePatientBrief } from './openaiService.js';

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
  });

  patient.briefHistory = patient.briefHistory || [];
  patient.briefHistory.push({
    summary: patientBrief.brief || patientBrief.summary || '',
    generatedAt: new Date(),
    source: 'Agent 1 Leader',
    patientFiles: patientFileSummaries || []
  });
  await patient.save();

  return {
    drugSafety,
    patientBrief
  };
};
