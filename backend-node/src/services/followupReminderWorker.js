import { FollowUp } from '../models/FollowUp.js';
import { Patient } from '../models/Patient.js';
import { User } from '../models/User.js';
import { sendWhatsAppMessage } from './twilioService.js';

const REMINDER_LOOKAHEAD_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
const CLAIM_STALE_MS = 15 * 60 * 1000; // 15 minutes

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const buildReminderMessage = (type, followUp, patientName, doctorName) => {
  const appointmentDate = formatDate(followUp.followUpDate);
  switch (type) {
    case 'day-before':
      return `Hello ${patientName}, this is a reminder from Dr. ${doctorName}. Your follow-up appointment is scheduled for ${appointmentDate}. Reason: ${followUp.followUpReason || 'Follow-up appointment'}.`;
    case 'day-of':
      return `Good morning ${patientName}! Your follow-up appointment is today (${appointmentDate}). Reason: ${followUp.followUpReason || 'Follow-up appointment'}.`;
    case 'during':
      return `Hi ${patientName}, your follow-up appointment is now (${appointmentDate}). Please arrive on time and contact us if you need to reschedule.`;
    default:
      return '';
  }
};

const determineReminderType = (followUp, now) => {
  const appointmentDate = new Date(followUp.followUpDate);
  const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000);
  const dayOfReminder = new Date(appointmentDate);
  dayOfReminder.setHours(8, 0, 0, 0);

  if (followUp.reminderStage === 'none' && now >= oneDayBefore) return 'day-before';
  if (followUp.reminderStage === 'day-before' && now >= dayOfReminder) return 'day-of';
  if (followUp.reminderStage === 'day-of' && now >= appointmentDate) return 'during';
  return null;
};

const findCandidates = async () => {
  const now = new Date();
  const futureLimit = new Date(now.getTime() + REMINDER_LOOKAHEAD_MS);
  return FollowUp.find({
    status: 'confirmed',
    invitationSent: true,
    followUpDate: { $gte: now, $lte: futureLimit }
  }).sort({ followUpDate: 1 });
};

const claimReminder = async (followUp, now) => {
  const staleThreshold = new Date(now.getTime() - CLAIM_STALE_MS);
  return FollowUp.findOneAndUpdate(
    {
      _id: followUp._id,
      reminderStage: followUp.reminderStage,
      status: 'confirmed',
      invitationSent: true,
      $or: [
        { reminderClaimedAt: { $exists: false } },
        { reminderClaimedAt: null },
        { reminderClaimedAt: { $lt: staleThreshold } }
      ]
    },
    { $set: { reminderClaimedAt: now } },
    { new: true }
  );
};

const releaseClaim = async (followUpId) => {
  await FollowUp.findByIdAndUpdate(followUpId, { $set: { reminderClaimedAt: null } });
};

const completeReminder = async (followUpId, reminderType) => {
  await FollowUp.findByIdAndUpdate(followUpId, {
    $set: {
      reminderStage: reminderType,
      reminderSentAt: new Date(),
      reminderClaimedAt: null
    }
  });
};

export const runFollowupReminderWorker = async () => {
  try {
    const now = new Date();
    const followUps = await findCandidates();

    const results = {
      checked: followUps.length,
      sent: 0,
      skipped: 0,
      errors: 0
    };

    for (const followUp of followUps) {
      const reminderType = determineReminderType(followUp, now);
      if (!reminderType) {
        results.skipped += 1;
        continue;
      }

      const claimedFollowUp = await claimReminder(followUp, now);
      if (!claimedFollowUp) {
        results.skipped += 1;
        continue;
      }

      const patient = await Patient.findById(claimedFollowUp.patientId).select('firstName lastName phone');
      const doctor = await User.findById(claimedFollowUp.doctorId).select('firstName lastName');
      if (!patient) {
        await releaseClaim(claimedFollowUp._id);
        results.skipped += 1;
        continue;
      }

      const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'there';
      const doctorName = `${doctor?.firstName || ''} ${doctor?.lastName || ''}`.trim() || 'Clinix AI';
      const message = buildReminderMessage(reminderType, claimedFollowUp, patientName, doctorName);
      if (!message) {
        await releaseClaim(claimedFollowUp._id);
        results.skipped += 1;
        continue;
      }

      const to = `whatsapp:${claimedFollowUp.patientPhone || patient.phone}`;
      try {
        await sendWhatsAppMessage(to, message);
        await completeReminder(claimedFollowUp._id, reminderType);
        results.sent += 1;
        console.log(`[Followup Reminder] Sent ${reminderType} reminder for FollowUp ${claimedFollowUp._id}`);
      } catch (error) {
        await releaseClaim(claimedFollowUp._id);
        results.errors += 1;
        console.error(`[Followup Reminder] Failed to send ${reminderType} reminder for FollowUp ${claimedFollowUp._id}:`, error);
      }
    }

    return results;
  } catch (error) {
    console.error('[Followup Reminder Worker] Error running reminder worker:', error);
    return { checked: 0, sent: 0, skipped: 0, errors: 1 };
  }
};
