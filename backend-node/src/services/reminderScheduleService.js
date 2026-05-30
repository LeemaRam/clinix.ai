import { FollowUp } from '../models/FollowUp.js';
import { sendWhatsAppMessage } from './twilioService.js';
import { env } from '../config/env.js';

/**
 * Schedule reminders for follow-up appointments
 * Reminders: 1 day before, day of appointment, and during appointment time
 */
export const scheduleFollowUpReminders = async (followUpId) => {
  try {
    const followUp = await FollowUp.findById(followUpId)
      .populate('patientId', 'firstName lastName phone')
      .populate('doctorId', 'fullName');

    if (!followUp) {
      console.error('Follow-up not found for reminder scheduling');
      return;
    }

    const appointmentDate = new Date(followUp.followUpDate);
    const now = new Date();

    // Schedule 1-day-before reminder
    const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
    if (oneDayBefore > now) {
      const delayMs = oneDayBefore.getTime() - now.getTime();
      scheduleReminder(delayMs, followUp, 'day-before');
    }

    // Schedule day-of appointment reminder (morning)
    const dayOfReminder = new Date(appointmentDate);
    dayOfReminder.setHours(8, 0, 0, 0); // 8 AM on appointment day
    if (dayOfReminder > now) {
      const delayMs = dayOfReminder.getTime() - now.getTime();
      scheduleReminder(delayMs, followUp, 'day-of');
    }

    // Schedule during-appointment reminder
    if (appointmentDate > now) {
      const delayMs = appointmentDate.getTime() - now.getTime();
      scheduleReminder(delayMs, followUp, 'during');
    }

    console.log(`[Reminders] Scheduled 3 reminders for follow-up ${followUpId}`);
  } catch (error) {
    console.error('[scheduleFollowUpReminders] Error:', error);
  }
};

/**
 * Schedule a single reminder to send at a specific time
 */
const scheduleReminder = (delayMs, followUp, type) => {
  setTimeout(async () => {
    try {
      const patient = followUp.patientId;
      const doctor = followUp.doctorId;
      const to = `whatsapp:${followUp.patientPhone}`;

      let message = '';
      switch (type) {
        case 'day-before':
          message = `Hi ${patient.firstName}, this is a reminder from Dr. ${doctor.fullName}. Your follow-up appointment is scheduled for tomorrow (${followUp.followUpDate.toLocaleDateString()}). Reason: ${followUp.followUpReason}. Please confirm your attendance.`;
          break;
        case 'day-of':
          message = `Good morning ${patient.firstName}! Your consultation with Dr. ${doctor.fullName} is today at ${followUp.followUpDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please arrive 10 minutes early.`;
          break;
        case 'during':
          message = `Hi ${patient.firstName}, your consultation with Dr. ${doctor.fullName} is starting now. Please be ready for the appointment.`;
          break;
      }

      await sendWhatsAppMessage(to, message);
      console.log(`[Reminder] ${type} reminder sent for follow-up ${followUp._id}`);
    } catch (error) {
      console.error(`[Reminder] Failed to send ${type} reminder:`, error);
    }
  }, delayMs);
};
