import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { deleteReport, downloadReport, getReport, listReports } from '../controllers/reportController.js';

const router = Router();

router.use(authRequired);
router.get('/', listReports);
router.get('/:id', getReport);
router.get('/:id/download', downloadReport);
router.delete('/:id', deleteReport);

export default router;
