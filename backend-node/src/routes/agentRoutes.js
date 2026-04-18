import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { checkDrugSafety, getPatientBrief } from '../controllers/agentController.js';

const router = Router();
router.use(authRequired);
router.post('/drug-check', checkDrugSafety);
router.get('/patient-brief/:patientId', getPatientBrief);
export default router;