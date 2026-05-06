import { FollowUp } from '../models/FollowUp.js';
import { Patient } from '../models/Patient.js';
import { Consultation } from '../models/Consultation.js';
import { Transcription } from '../models/Transcription.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import axios from 'axios';
import { env } from '../config/env.js';
import { sendWhatsAppMessage } from '../services/twilioService.js';
import { scheduleFollowUpReminders } from '../services/reminderScheduleService.js';

export const listFollowUps = asyncHandler(async (req, res) => {
  const doctorId = req.user.id;
  const followUps = await FollowUp.find({ doctorId })
    .populate('patientId', 'firstName lastName')
    .populate('consultationId', 'consultationType')
    .sort({ followUpDate: 1 });
  res.json({ success: true, data: followUps });
});

export const scheduleFollowUp = asyncHandler(async (req, res) => {
  const { consultationId, followUpDate, followUpReason, patientPhone } = req.body;
  const doctorId = req.user.id;

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
      const followupInfo = await axios.post(`${env.PYTHON_AI_SERVICE_URL}/extract-followup`, {
        soap_note: transcription.analysis,
        consultation_id: consultationId
      });
      reason = followupInfo.data.follow_up_reason;
      days = followupInfo.data.follow_up_days;
    }
  }

  const followUp = new FollowUp({
    consultationId,
    patientId: patient._id,
    doctorId,
    followUpDate: followUpDate || new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    followUpReason: reason,
    patientPhone: patientPhone || patient.phone
  });

  await followUp.save();
  
  // Schedule automatic reminders
  await scheduleFollowUpReminders(followUp._id);
  
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
    followUp.status = 'sent';
    await followUp.save();
    res.json({ success: true, message: 'Reminder sent via WhatsApp' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send WhatsApp reminder' });
  }
});