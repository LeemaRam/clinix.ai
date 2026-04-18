import express from 'express';
import { drugSafetyCheck } from '../controllers/aiController.js';

const router = express.Router();

router.post('/drug-safety', drugSafetyCheck);

export default router;