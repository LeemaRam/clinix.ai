import express from 'express';
import { drugSafetyCheck } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Drug safety calls reach external AI providers and must not be open to the public.
router.post('/drug-safety', protect, drugSafetyCheck);

export default router;