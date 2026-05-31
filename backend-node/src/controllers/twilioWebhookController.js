import { FollowUp } from '../models/FollowUp.js';
import { Patient } from '../models/Patient.js';
import { Appointment } from '../models/Appointment.js';
import { getSocketServer } from '../socket.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// SECURITY TODO: Twilio webhook signature verification is NOT implemented yet.
// This endpoint will currently accept any POST as if it came from Twilio, which
// means an attacker who knows the URL can forge appointment confirm/decline
// events. Before this webhook is exposed publicly:
//   1. Capture the public webhook URL (e.g. https://api.example.com/api/webhooks/twilio/whatsapp).
//   2. Use Twilio's `validateRequest` (from the `twilio` npm package) with
//      process.env.TWILIO_AUTH_TOKEN, the full public URL, and the form-encoded
//      body to verify the `X-Twilio-Signature` header on every request.
//   3. Reject with HTTP 403 when validation fails.
// Intentionally left as a TODO until the production webhook URL is known so
// signature validation is not silently misconfigured against the wrong URL.

const normalizeWhatsAppSender = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  return trimmed.startsWith('+') ? `whatsapp:${trimmed}` : `whatsapp:${trimmed}`;
};

const normalizeReply = (body) => {
  if (!body) return '';
  return String(body).trim();
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const parseReplyPayload = (body) => {
  const normalized = normalizeReply(body).toUpperCase();
  const referenceMatch = normalized.match(/\bREF-[A-Z0-9]{6,12}\b/);
  let action = null;

  if (/\b1\b/.test(normalized)) {
    action = '1';
  } else if (/\b2\b/.test(normalized)) {
    action = '2';
  } else if (/\b(CONFIRM|YES|Y|ACCEPT|SURE|OKAY|OK)\b/.test(normalized)) {
    action = '1';
  } else if (/\b(DECLINE|NO|N|CANCEL|NOT NOW|NOT)\b/.test(normalized)) {
    action = '2';
  }

  return {
    action,
    referenceCode: referenceMatch ? referenceMatch[0] : null
  };
};

const findPendingAppointmentByPhone = async (from) => {
  const normalized = normalizeWhatsAppSender(from).replace('whatsapp:', '');
  const digits = digitsOnly(normalized);
  if (!digits) return null;

  return Appointment.findOne({
    patientPhone: { $regex: `${digits}$`, $options: 'i' },
    invitationSent: true,
    status: 'pending'
  }).sort({ createdAt: -1 });
};

export const handleTwilioWhatsAppWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body.Body || req.body.body || '';
  const { action, referenceCode } = parseReplyPayload(rawBody);
  const from = req.body.From || req.body.from || '';

  let appointment = null;
  if (referenceCode) {
    appointment = await Appointment.findOne({
      referenceCode,
      invitationSent: true,
      status: 'pending'
    });
  }

  if (!appointment) {
    appointment = await findPendingAppointmentByPhone(from);
  }

  if (!appointment) {
    console.warn(`[Twilio Webhook] No pending appointment found for sender ${from} (${referenceCode || 'no reference code'})`);
    return res.status(200).send('<Response></Response>');
  }

  const patient = await Patient.findById(appointment.patientId).select('firstName lastName');
  const patientName = `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient';

  if (action === '1') {
    appointment.status = 'confirmed';
    appointment.confirmedAt = new Date();
    await appointment.save();

    const followUp = new FollowUp({
      consultationId: appointment.consultationId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentId: appointment._id,
      followUpDate: new Date(appointment.preferredDate),
      followUpReason: appointment.reason,
      patientPhone: appointment.patientPhone,
      status: 'confirmed',
      confirmedAt: new Date(),
      appointmentCreatedAt: new Date()
    });
    await followUp.save();

    appointment.followUpId = followUp._id;
    appointment.followUpCreatedAt = new Date();
    await appointment.save();

    const io = getSocketServer();
    if (io) {
      io.emit('appointment_confirmed', { appointment: appointment.toObject(), followUp: followUp.toObject() });
    }

    console.log(`[Twilio Webhook] Appointment ${appointment._id} confirmed and FollowUp ${followUp._id} created`);
  } else if (action === '2') {
    appointment.status = 'cancelled';
    await appointment.save();
    console.log(`[Twilio Webhook] Appointment ${appointment._id} declined by patient ${from}`);
  } else {
    console.log(`[Twilio Webhook] Ignored non-actionable reply '${rawBody}' from ${from}`);
  }

  return res.status(200).send('<Response></Response>');
});