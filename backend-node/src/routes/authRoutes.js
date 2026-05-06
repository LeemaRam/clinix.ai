import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { loginUser, registerUser } from '../controllers/authController.js';

const router = Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes (example)
router.get('/profile', protect, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

export default router;