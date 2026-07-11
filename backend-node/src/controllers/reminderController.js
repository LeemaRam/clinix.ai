import { asyncHandler } from '../utils/asyncHandler.js';
import { runFollowupReminderWorker } from '../services/followupReminderWorker.js';
import { env } from '../config/env.js';

export const runFollowupReminders = asyncHandler(async (req, res) => {
  const expected = env.REMINDER_RUN_SECRET || '';
  const provided = req.header('x-reminder-secret') || req.query.secret || '';

  // Require the secret to be configured AND to match. If either is missing/mismatched,
  // refuse the request. This endpoint can trigger outbound WhatsApp messages, so it
  // must never be callable without explicit authorization.
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const results = await runFollowupReminderWorker();
  res.json({ success: true, data: results });
});
