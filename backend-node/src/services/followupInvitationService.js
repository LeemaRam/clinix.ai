import { FollowUp } from '../models/FollowUp.js';
import { Appointment } from '../models/Appointment.js';
import { User } from '../models/User.js';
import { sendWhatsAppMessage } from './twilioService.js';

const normalizePhoneForWhatsApp = (phone) => {
  if (!phone) return '';
  const trimmed = String(phone).trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  return trimmed.startsWith('+') ? `whatsapp:${trimmed}` : `whatsapp:${trimmed}`;
};

export const sendFollowupInvitation = async ({ followUpId, patientName, patientPhone, doctorName, followUpDate }) => {
  const followUp = await FollowUp.findById(followUpId);
  if (!followUp) {
    throw new Error(`FollowUp not found: ${followUpId}`);
  }

  const to = normalizePhoneForWhatsApp(patientPhone || followUp.patientPhone);
  const dateText = followUpDate
    ? new Date(followUpDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(followUp.followUpDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  const message = `Hello ${patientName},\n\nDr. ${doctorName} has recommended a follow-up appointment on ${dateText}.\n\nReference: ${followUp.referenceCode}\n\nReply with one of the following:\n1 ${followUp.referenceCode} = Confirm Appointment\n2 ${followUp.referenceCode} = Decline Appointment\n\nThank you,\nClinix AI`;

  const response = await sendWhatsAppMessage(to, message);
  followUp.invitationSent = true;
  await followUp.save();

  console.log('[FollowUp Invitation] Invitation sent for followUp', followUpId, { to, followUpDate: dateText });
  return response;
};

export const sendAppointmentInvitation = async ({ appointmentId, patientName, patientPhone, doctorName, appointmentDate }) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new Error(`Appointment not found: ${appointmentId}`);
  }

  const to = normalizePhoneForWhatsApp(patientPhone || appointment.patientPhone);
  const dateText = appointmentDate
    ? new Date(appointmentDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date(appointment.preferredDate).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });

  const message = `Hello ${patientName},\n\nDr. ${doctorName} has proposed a follow-up appointment on ${dateText}.\n\nReference: ${appointment.referenceCode}\n\nReply with one of the following:\n1 ${appointment.referenceCode} = Confirm Appointment\n2 ${appointment.referenceCode} = Decline Appointment\n\nThank you,\nClinix AI`;

  const response = await sendWhatsAppMessage(to, message);
  appointment.invitationSent = true;
  appointment.invitationSentAt = new Date();
  await appointment.save();

  console.log('[Appointment Invitation] Invitation sent for appointment', appointmentId, { to, appointmentDate: dateText });
  return response;
};

export const getDoctorName = async (doctorId) => {
  if (!doctorId) return 'Clinix AI';
  const doctor = await User.findById(doctorId).select('firstName lastName');
  if (!doctor) return 'Clinix AI';
  const name = `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
  return name || 'Clinix AI';
};