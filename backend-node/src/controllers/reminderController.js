import { asyncHandler } from '../utils/asyncHandler.js';
import { runFollowupReminderWorker } from '../services/followupReminderWorker.js';
import { env } from '../config/env.js';

export const runFollowupReminders = asyncHandler(async (req, res) => {
  const secret = req.header('x-reminder-secret') || req.query.secret || '';
  if (env.REMINDER_RUN_SECRET && secret !== env.REMINDER_RUN_SECRET) {
    return res.status(403).json({ success: false, error: 'Invalid reminder secret' });
  }

  const results = await runFollowupReminderWorker();
  res.json({ success: true, data: results });
});
