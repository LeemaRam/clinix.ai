import { Router } from 'express';
import { handleTwilioWhatsAppWebhook } from '../controllers/twilioWebhookController.js';

const router = Router();
router.post('/twilio/whatsapp', handleTwilioWhatsAppWebhook);

export default router;
