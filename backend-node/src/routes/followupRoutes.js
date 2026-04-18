import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { listFollowUps, scheduleFollowUp, sendReminder } from '../controllers/followupController.js';

const router = Router();
router.use(authRequired);
router.get('/', listFollowUps);
router.post('/', scheduleFollowUp);
router.post('/:id/send', sendReminder);
export default router;