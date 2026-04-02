import { Router } from 'express';
import { getCurrentUser, login, register, validateToken } from '../controllers/authController.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/validate-token', authRequired, validateToken);
router.get('/me', authRequired, getCurrentUser);

export default router;
