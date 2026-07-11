import { FollowUp } from '../models/FollowUp.js';
import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Transcription } from '../models/Transcription.js';
import { asyncHandler } from '../utils/asyncHandler.js';
<<<<<<< HEAD
import { extractFollowupDetails } from '../services/openaiService.js';
import { sendFollowupInvitation, getDoctorName } from '../services/followupInvitationService.js';
import { sendWhatsAppMessage } from '../services/twilioService.js';
<<<<<<< HEAD
=======
import axios from 'axios';
import { env } from '../config/env.js';
import { sendWhatsAppMessage } from '../services/twilioService.js';
import { scheduleFollowUpReminders } from '../services/reminderScheduleService.js';
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
=======
import {
  validateFutureDateTime,
  validatePhone,
  validateText,
  normalizePhone,
  collectErrors,
  throwIfErrors
} from '../utils/validation.js';
>>>>>>> my-working-code

export const listFollowUps = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;
  const followUps = await FollowUp.find({ doctorId })
    .populate('patientId', 'firstName lastName')
    .populate('consultationId', 'consultationType')
    .sort({ followUpDate: 1 });
  res.json({ success: true, data: followUps });
});

export const scheduleFollowUp = asyncHandler(async (req, res) => {
  const { consultationId, followUpDate, followUpReason, patientPhone } = req.body || {};
  const doctorId = req.user.id;

  if (!consultationId) {
    throwIfErrors(collectErrors([['consultationId', 'Consultation id is required']]));
  }

  const errors = collectErrors([
    followUpDate !== undefined ? ['followUpDate', validateFutureDateTime(followUpDate)] : [null, null],
    followUpReason !== undefined ? ['followUpReason', validateText(followUpReason, { required: false, label: 'Reason', max: 300 })] : [null, null],
    patientPhone !== undefined ? ['patientPhone', validatePhone(patientPhone, { required: false })] : [null, null]
  ].filter(([field]) => field));
  throwIfErrors(errors);

  // Get consultation and patient
  const consultation = await Consultation.findOne({ _id: consultationId, doctorId });
  if (!consultation) return res.status(404).json({ success: false, error: 'Consultation not found' });

  const patient = await Patient.findOne({ _id: consultation.patientId, doctorId });
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  // Extract from SOAP if not provided
  let reason = followUpReason;
  let days = 7;
  if (!reason) {
    const transcription = await Transcription.findOne({ consultationId });
    if (transcription && transcription.analysis) {
      try {
        const followupInfo = await extractFollowupDetails(transcription.analysis);
        reason = followupInfo?.follow_up_reason || reason;
        days = Number(followupInfo?.follow_up_days || days) || days;
      } catch (error) {
        console.error('[followupController] extractFollowupDetails failed, using fallback values:', error?.message || error);
      }
    }
  }
  reason = String(reason || 'Routine follow-up').trim() || 'Routine follow-up';
  days = Number(days) || 7;

  const followUp = new FollowUp({
    consultationId,
    patientId: patient._id,
    doctorId,
    followUpDate: followUpDate || new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    followUpReason: reason,
    patientPhone: patientPhone ? normalizePhone(patientPhone) : (patient.phone ? normalizePhone(patient.phone) : patient.phone)
  });

  await followUp.save();
<<<<<<< HEAD

  try {
    const doctorName = await getDoctorName(doctorId);
    await sendFollowupInvitation({
      followUpId: followUp._id,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient',
      patientPhone: followUp.patientPhone,
      doctorName,
      followUpDate: followUp.followUpDate
    });
  } catch (error) {
    console.error('[followupController] sendFollowupInvitation failed:', error);
  }

=======
  
  // Schedule automatic reminders
  await scheduleFollowUpReminders(followUp._id);
  
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  res.json({ success: true, data: followUp });
});

export const sendReminder = asyncHandler(async (req, res) => {
  const followUp = await FollowUp.findOne({ _id: req.params.id, doctorId: req.user.id })
    .populate('patientId', 'firstName lastName phone')
    .populate('doctorId', 'firstName lastName');
  if (!followUp) return res.status(404).json({ success: false, error: 'Follow-up not found' });

  // Send WhatsApp message using Twilio
  const message = `Hello ${followUp.patientId.firstName}, this is a reminder from Dr. ${followUp.doctorId.firstName} ${followUp.doctorId.lastName}. Your follow-up is scheduled for ${followUp.followUpDate.toISOString().split('T')[0]}. Reason: ${followUp.followUpReason}`;
  const to = `whatsapp:${followUp.patientPhone}`;

  try {
    await sendWhatsAppMessage(to, message);
    followUp.reminderSent = true;
    followUp.reminderSentAt = new Date();
<<<<<<< HEAD
    await followUp.save();
    res.json({ success: true, message: 'Reminder sent via WhatsApp' });
  } catch (error) {
    console.error('[followupController] sendReminder failed:', error);
    const message = error?.message || 'Failed to send WhatsApp reminder';
    res.status(500).json({ success: false, error: message });
=======
    followUp.status = 'sent';
    await followUp.save();
    res.json({ success: true, message: 'Reminder sent via WhatsApp' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send WhatsApp reminder' });
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  }
});