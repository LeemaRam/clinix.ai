import { Router } from 'express';
import { testGemini, testGeminiSoap } from '../controllers/testController.js';

const router = Router();

router.get('/gemini', testGemini);
router.post('/gemini-soap', testGeminiSoap);

export default router;
