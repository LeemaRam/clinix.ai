import { Router } from 'express';
import { protect } from '../middleware/auth.js';
<<<<<<< HEAD
import { loginUser, registerUser, validateToken, logoutUser } from '../controllers/authController.js';
=======
import { loginUser, registerUser } from '../controllers/authController.js';
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

const router = Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

<<<<<<< HEAD
// Token validation endpoint for frontend session sync
router.get('/validate-token', protect, validateToken);
router.post('/logout', protect, logoutUser);

=======
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
// Protected routes (example)
router.get('/profile', protect, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

export default router;