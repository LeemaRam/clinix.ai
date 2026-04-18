import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { changePassword, getLanguage, getProfile, setLanguage, updateProfile } from '../controllers/userController.js';

const router = Router();

router.use(authRequired);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/change-password', changePassword);
router.get('/language', getLanguage);
router.put('/language', setLanguage);

export default router;
