import { Router } from 'express';
import {
  handleTwilioWhatsAppWebhook,
  verifyTwilioWebhookSignature
} from '../controllers/twilioWebhookController.js';

const router = Router();
router.post('/twilio/whatsapp', verifyTwilioWebhookSignature, handleTwilioWhatsAppWebhook);

export default router;
