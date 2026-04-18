import axios from 'axios';
import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Transcription } from '../models/Transcription.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

export const checkDrugSafety = asyncHandler(async (req, res) => {
  const { new_drugs, existing_drugs } = req.body;
  if (!new_drugs || !Array.isArray(new_drugs)) {
    return res.status(400).json({ success: false, error: 'new_drugs array required' });
  }
  try {
    const result = await axios.post(
      `${env.PYTHON_AI_SERVICE_URL}/drug-check`,
      { new_drugs, existing_drugs: existing_drugs || [] }
    );
    res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(502).json({ success: false, error: 'Drug check service unavailable', details: e.message });
  }
});

export const getPatientBrief = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.patientId, doctorId: req.user.id });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });
  const consultations = await Consultation.find({ patientId: patient._id })
    .sort({ createdAt: -1 }).limit(5).lean();
  const transcriptions = await Transcription.find({
    consultationId: { $in: consultations.map(c => c._id) }
  }).lean();
  try {
    const result = await axios.post(`${env.PYTHON_AI_SERVICE_URL}/patient-brief`, {
      patient: {
        name: `${patient.firstName} ${patient.lastName}`,
        age: patient.dateOfBirth,
        allergies: patient.allergies || [],
        currentMedications: patient.currentMedications || [],
        medicalConditions: patient.medicalConditions || []
      },
      recentConsultations: transcriptions.map(t => ({
        summary: t.analysis?.subjective || t.analysis?.summary || '',
        medications: t.analysis?.medications_mentioned || [],
        diagnoses: t.analysis?.assessment || []
      }))
    });
    res.json({ success: true, data: result.data });
  } catch (e) {
    res.status(502).json({ success: false, error: 'Patient brief service unavailable', details: e.message });
  }
});