import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { stats } from '../controllers/dashboardController.js';

const router = Router();

router.get('/stats', authRequired, stats);

export default router;
