import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { bookAppointment, listAppointments, updateAppointment } from '../controllers/appointmentController.js';

const router = Router();
router.post('/', bookAppointment);          // Public — no auth
router.get('/', authRequired, listAppointments);
router.patch('/:id', authRequired, updateAppointment);
export default router;