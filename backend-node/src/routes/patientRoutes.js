import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { createPatient, getPatient, listPatients, updatePatient } from '../controllers/patientController.js';

const router = Router();

router.use(authRequired);
router.get('/', listPatients);
router.post('/', createPatient);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);

export default router;
