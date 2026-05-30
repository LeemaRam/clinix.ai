import { Router } from 'express';
import { testOpenAI, testOpenAISoap } from '../controllers/testController.js';

const router = Router();

router.get('/openai', testOpenAI);
router.post('/openai-soap', testOpenAISoap);

export default router;
