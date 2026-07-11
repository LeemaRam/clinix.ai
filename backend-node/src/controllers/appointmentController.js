import { Appointment } from '../models/Appointment.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getSocketServer } from '../socket.js';
import {
  validateName,
  validatePhone,
  validateFutureDateTime,
  validateText,
  validateEnum,
  normalizePhone,
  collectErrors,
  throwIfErrors
} from '../utils/validation.js';

export const bookAppointment = asyncHandler(async (req, res) => {
  const { patient_name, patient_phone, preferred_date, reason, doctor_id } = req.body || {};

  const errors = collectErrors([
    ['patient_name', validateName(patient_name, { label: 'Patient name' })],
    ['patient_phone', validatePhone(patient_phone)],
    ['preferred_date', validateFutureDateTime(preferred_date)],
    ['reason', validateText(reason, { required: false, label: 'Reason', max: 300 })]
  ]);
  throwIfErrors(errors);

  const appointment = new Appointment({
    patientName: String(patient_name).trim(),
    patientPhone: normalizePhone(patient_phone),
    preferredDate: String(preferred_date).trim(),
    reason: reason ? String(reason).trim() : undefined,
    doctorId: doctor_id
  });

  await appointment.save();

  const io = getSocketServer();
  if (io) {
    io.emit('appointment_created', { appointment: appointment.toObject() });
  }

  res.json({ success: true, data: appointment });
});

export const listAppointments = asyncHandler(async (req, res) => {
  const filter = {
    $or: [
      { doctorId: req.user.id },
      { doctorId: { $exists: false } },
      { doctorId: null }
    ]
  };
  const appointments = await Appointment.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data: appointments });
});

export const updateAppointment = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  const statusError = validateEnum(status, ['pending', 'confirmed', 'completed', 'cancelled'], { label: 'Status' });
  throwIfErrors(collectErrors([['status', statusError]]));

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return res.status(404).json({ success: false, error: 'Appointment not found' });
  }

  if (appointment.doctorId && appointment.doctorId.toString() !== req.user.id) {
    return res.status(403).json({ success: false, error: 'Not authorized to update this appointment' });
  }

  appointment.status = status;
  await appointment.save();

  res.json({ success: true, data: appointment });
});