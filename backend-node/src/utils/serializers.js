export const toId = (value) => (value ? value.toString() : null);

export const serializeUser = (u) => ({
  id: toId(u._id),
  email: u.email,
  full_name: u.fullName,
  role: u.role,
  is_active: Boolean(u.isActive),
  language: u.language || 'en',
  phone: u.phone || ''
});

export const serializePatient = (p) => ({
  id: toId(p._id),
  first_name: p.firstName,
  last_name: p.lastName,
  email: p.email || '',
  phone: p.phone || '',
  date_of_birth: p.dateOfBirth,
  gender: p.gender,
  blood_type: p.bloodType || '',
  address: p.address || '',
  emergency_contact_name: p.emergencyContactName || '',
  emergency_contact_phone: p.emergencyContactPhone || '',
  medical_conditions: p.medicalConditions || [],
  allergies: p.allergies || [],
  current_medications: p.currentMedications || [],
  vital_signs: p.vitalSigns || [],
  notes: p.notes || [],
  doctor_id: toId(p.doctorId),
  status: p.status || 'new',
  last_visit: p.lastVisit,
  created_at: p.createdAt,
  updated_at: p.updatedAt
});

export const serializeConsultation = (c) => ({
  id: toId(c._id),
  patient_id: toId(c.patientId?._id || c.patientId),
  doctor_id: toId(c.doctorId?._id || c.doctorId),
  consultation_type: c.consultationType,
  recording_type: c.recordingType,
  consent_obtained: Boolean(c.consentObtained),
  consent_timestamp: c.consentTimestamp,
  status: c.status,
  scheduled_at: c.scheduledAt,
  started_at: c.startedAt,
  ended_at: c.endedAt,
  notes: c.notes || '',
  patient: c.patientId && c.patientId.firstName ? serializePatient(c.patientId) : undefined,
  doctor: c.doctorId && c.doctorId.fullName ? serializeUser(c.doctorId) : undefined,
  created_at: c.createdAt,
  updated_at: c.updatedAt
});

export const serializeTranscription = (t) => ({
  id: toId(t._id),
  consultation_id: toId(t.consultationId),
  status: t.status,
  language: t.language,
  speech_language: t.speechLanguage,
  model_used: t.modelUsed,
  raw_text: t.rawText,
  segments: (t.segments || []).map((segment) => ({
    id: segment.id,
    start: segment.start,
    end: segment.end,
    text: segment.text,
    confidence: segment.confidence,
    no_speech_prob: segment.noSpeechProb ?? 0,
    avg_logprob: segment.avgLogprob ?? 0,
    compression_ratio: segment.compressionRatio ?? 0,
    speaker: segment.speaker || 'unknown'
  })),
  confidence_score: t.confidenceScore || 0,
  duration: t.duration || 0,
  analysis: t.analysis || {},
  audio_file_path: t.audioFilePath,
  processing_time: t.processingTime || 0,
  started_at: t.startedAt,
  completed_at: t.completedAt,
  created_at: t.createdAt,
  updated_at: t.updatedAt
});

export const serializeReport = (r) => ({
  id: toId(r._id),
  consultation_id: toId(r.consultationId),
  patient_id: toId(r.patientId),
  doctor_id: toId(r.doctorId),
  format: r.format,
  status: r.status,
  content: r.content,
  filename: r.filename || (r.filePath ? r.filePath.split('/').pop() : ''),
  pdf_path: r.filePath,
  download_url: r.downloadUrl || '',
  created_at: r.createdAt
});
