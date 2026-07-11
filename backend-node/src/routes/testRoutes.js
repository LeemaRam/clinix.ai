import { Router } from 'express';
import { testOpenAI, testOpenAISoap } from '../controllers/testController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

// These are diagnostic routes that make real OpenAI calls and therefore must not
// be publicly reachable. They are restricted to authenticated super-admin users.
router.get('/openai', protect, authorize('super_admin'), testOpenAI);
router.post('/openai-soap', protect, authorize('super_admin'), testOpenAISoap);

export default router;
