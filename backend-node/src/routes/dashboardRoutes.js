import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { stats, analyticsOverview, consultationTrend, topDiagnoses } from '../controllers/dashboardController.js';

const router = Router();

router.get('/stats', authRequired, stats);
router.get('/analytics', authRequired, analyticsOverview);
router.get('/trends', authRequired, consultationTrend);
router.get('/diagnoses', authRequired, topDiagnoses);

export default router;
