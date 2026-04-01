import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { serializePatient, serializeConsultation } from '../utils/serializers.js';

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

  res.json({
    patients: patients.map(serializePatient),
    total,
    page,
    pages: Math.ceil(total / limit)
  });
});

export const createPatient = asyncHandler(async (req, res) => {
  const body = req.body;
  const patient = await Patient.create({
    firstName: body.first_name,
    lastName: body.last_name,
    email: body.email,
    phone: body.phone,
    dateOfBirth: body.date_of_birth,
    gender: body.gender,
    bloodType: body.blood_type,
    address: body.address,
    emergencyContactName: body.emergency_contact_name,
    emergencyContactPhone: body.emergency_contact_phone,
    medicalConditions: body.medical_conditions || [],
    allergies: body.allergies || [],
    currentMedications: body.current_medications || [],
    doctorId: req.user.id
  });

  res.status(201).json({ patient: serializePatient(patient) });
});

export const getPatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.user.id });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const consultations = await Consultation.find({ patientId: patient._id }).sort({ createdAt: -1 }).limit(50);
  const data = serializePatient(patient);
  data.consultations = consultations.map(serializeConsultation);

  res.json({ patient: data });
});

export const updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, doctorId: req.user.id });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const body = req.body;
  if (typeof body.note === 'string' && body.note.trim()) {
    patient.notes.push({ content: body.note.trim(), createdBy: req.user.id });
  }

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
    if (body[k] !== undefined) patient[v] = body[k];
  });

  await patient.save();
  res.json({ patient: serializePatient(patient) });
});
