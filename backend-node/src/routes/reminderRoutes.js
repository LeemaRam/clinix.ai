import { Router } from 'express';
import { runFollowupReminders } from '../controllers/reminderController.js';

const router = Router();
router.post('/run', runFollowupReminders);

export default router;
