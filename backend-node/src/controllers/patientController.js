import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { serializePatient, serializeConsultation } from '../utils/serializers.js';
import {
  validateName,
  validateEmail,
  validatePhone,
  validateDateOfBirth,
  validateEnum,
  validateText,
  normalizeEmail,
  normalizePhone,
  collectErrors,
  throwIfErrors
} from '../utils/validation.js';

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'male', 'female', 'other'];

const buildPatientErrors = (body, { partial = false } = {}) => {
  const entries = [];
  const isPresent = (key) => body[key] !== undefined;

  if (!partial || isPresent('first_name')) {
    entries.push(['first_name', validateName(body.first_name, { required: !partial, label: 'First name' })]);
  }
  if (!partial || isPresent('last_name')) {
    entries.push(['last_name', validateName(body.last_name, { required: !partial, label: 'Last name' })]);
  }
  if (!partial || isPresent('date_of_birth')) {
    entries.push(['date_of_birth', validateDateOfBirth(body.date_of_birth)]);
  }
  if (!partial || isPresent('gender')) {
    entries.push(['gender', validateEnum(body.gender, GENDER_OPTIONS, { label: 'Gender' })]);
  }
  if (isPresent('email')) {
    entries.push(['email', validateEmail(body.email, { required: false })]);
  }
  if (isPresent('phone')) {
    entries.push(['phone', validatePhone(body.phone, { required: false })]);
  }
  if (isPresent('emergency_contact_name')) {
    entries.push(['emergency_contact_name', validateName(body.emergency_contact_name, { required: false, label: 'Emergency contact name' })]);
  }
  if (isPresent('emergency_contact_phone')) {
    entries.push(['emergency_contact_phone', validatePhone(body.emergency_contact_phone, { required: false })]);
  }
  if (isPresent('address')) {
    entries.push(['address', validateText(body.address, { required: false, label: 'Address', max: 500 })]);
  }
  return collectErrors(entries);
};

export const listPatients = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const search = String(req.query.search || '').trim();

  const query = { doctorId: req.user.id };
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const [patients, total] = await Promise.all([
    Patient.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Patient.countDocuments(query)
  ]);

  const consultationCounts = await Consultation.aggregate([
    { $match: { patientId: { $in: patients.map((p) => p._id) } } },
    { $group: { _id: '$patientId', count: { $sum: 1 } } }
  ]);

  const countsByPatient = consultationCounts.reduce((acc, item) => {
    acc[item._id.toString()] = item.count;
    return acc;
  }, {});

  const data = {
    patients: patients.map((patient) => ({
      ...serializePatient(patient),
      consultation_count: countsByPatient[patient._id.toString()] || 0
    })),
    total,
    page,
    pages: Math.ceil(total / limit)
  };

  res.json({ success: true, data, ...data });
});

export const createPatient = asyncHandler(async (req, res) => {
  const body = req.body || {};
  throwIfErrors(buildPatientErrors(body));

  const patient = await Patient.create({
    firstName: String(body.first_name).trim(),
    lastName: String(body.last_name).trim(),
    email: body.email ? normalizeEmail(body.email) : undefined,
    phone: body.phone ? normalizePhone(body.phone) : undefined,
    dateOfBirth: body.date_of_birth,
    gender: body.gender,
    bloodType: body.blood_type,
    address: body.address ? String(body.address).trim() : undefined,
    emergencyContactName: body.emergency_contact_name ? String(body.emergency_contact_name).trim() : undefined,
    emergencyContactPhone: body.emergency_contact_phone ? normalizePhone(body.emergency_contact_phone) : undefined,
    medicalConditions: body.medical_conditions || [],
    allergies: body.allergies || [],
    currentMedications: body.current_medications || [],
    doctorId: req.user.id
  });

  const data = { patient: serializePatient(patient) };
  res.status(201).json({ success: true, data, ...data });
});

export const getPatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.user.id });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const consultations = await Consultation.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(50);
  const data = serializePatient(patient);
  data.consultations = consultations.map(serializeConsultation);

  const payload = { patient: data };
  res.json({ success: true, data: payload, ...payload });
});

export const updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.user.id });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const body = req.body || {};
  throwIfErrors(buildPatientErrors(body, { partial: true }));

  if (typeof body.note === 'string' && body.note.trim()) {
    patient.notes.push({ content: body.note.trim(), createdBy: req.user.id });
  }

  const transform = {
    first_name: (v) => String(v).trim(),
    last_name: (v) => String(v).trim(),
    email: (v) => (v ? normalizeEmail(v) : v),
    phone: (v) => (v ? normalizePhone(v) : v),
    emergency_contact_name: (v) => (v ? String(v).trim() : v),
    emergency_contact_phone: (v) => (v ? normalizePhone(v) : v),
    address: (v) => (typeof v === 'string' ? v.trim() : v)
  };

  const map = {
    first_name: 'firstName',
    last_name: 'lastName',
    email: 'email',
    phone: 'phone',
    date_of_birth: 'dateOfBirth',
    gender: 'gender',
    blood_type: 'bloodType',
    address: 'address',
    emergency_contact_name: 'emergencyContactName',
    emergency_contact_phone: 'emergencyContactPhone',
    medical_conditions: 'medicalConditions',
    allergies: 'allergies',
    current_medications: 'currentMedications'
  };

  Object.entries(map).forEach(([k, v]) => {
    if (body[k] !== undefined) {
      const fn = transform[k];
      patient[v] = fn ? fn(body[k]) : body[k];
    }
  });

  await patient.save();
  const data = { patient: serializePatient(patient) };
  res.json({ success: true, data, ...data });
});
