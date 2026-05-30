import twilio from 'twilio';
import { env } from '../config/env.js';

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

<<<<<<< HEAD
const normalizeWhatsAppAddress = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (trimmed.startsWith('whatsapp:')) return trimmed;
  return trimmed.startsWith('+') ? `whatsapp:${trimmed}` : `whatsapp:${trimmed}`;
};

const maskSensitiveValue = (value, visibleChars = 4) => {
  if (!value || typeof value !== 'string') return '***';
  if (value.length <= visibleChars) return '***';
  return `${value.slice(0, visibleChars)}...${value.slice(-visibleChars)}`;
};

// Validate and log Twilio configuration on startup
export const validateTwilioConfig = () => {
  const from = normalizeWhatsAppAddress(env.TWILIO_WHATSAPP_NUMBER);
  
  if (!env.TWILIO_ACCOUNT_SID) {
    console.warn('[Twilio Config] ⚠️  TWILIO_ACCOUNT_SID is not configured');
  }
  if (!env.TWILIO_AUTH_TOKEN) {
    console.warn('[Twilio Config] ⚠️  TWILIO_AUTH_TOKEN is not configured');
  }
  if (!from) {
    console.warn('[Twilio Config] ⚠️  TWILIO_WHATSAPP_NUMBER is not configured');
  }

  const fromValidation = from.startsWith('whatsapp:') ? '✓' : '✗';
  console.log('[Twilio Config] Configuration loaded', {
    fromValidation,
    from: from || '(not set)',
    accountSid: maskSensitiveValue(env.TWILIO_ACCOUNT_SID),
    sandbox: from.includes('14155238886') ? 'true (Twilio Sandbox)' : 'custom'
  });
};

=======
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
/**
 * Send a WhatsApp message using Twilio sandbox
 * @param {string} to - Recipient's WhatsApp number (e.g., 'whatsapp:+1234567890')
 * @param {string} message - Message content
 * @returns {Promise} Twilio message response
 */
export const sendWhatsAppMessage = async (to, message) => {
  try {
<<<<<<< HEAD
    const fromNumber = normalizeWhatsAppAddress(env.TWILIO_WHATSAPP_NUMBER);
    const toNumber = normalizeWhatsAppAddress(to);
    console.log('[twilioService] Sending WhatsApp message', { fromNumber, toNumber });
    const response = await client.messages.create({
      from: fromNumber,
      to: toNumber,
=======
    const response = await client.messages.create({
      from: env.TWILIO_WHATSAPP_NUMBER,
      to: to,
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
      body: message
    });
    return response;
  } catch (error) {
<<<<<<< HEAD
    const twilioError = error.code || 'UNKNOWN';
    const twilioMessage = error.message || 'Unknown error';
    const fromNumber = normalizeWhatsAppAddress(env.TWILIO_WHATSAPP_NUMBER);
    
    console.error('[twilioService] Failed to send WhatsApp message', {
      twilioErrorCode: twilioError,
      twilioErrorMessage: twilioMessage,
      from: fromNumber,
      to: normalizeWhatsAppAddress(to),
      errorDetails: error.details || error.toString()
    });
    
    throw Object.assign(new Error('Failed to send WhatsApp message'), {
      twilioErrorCode: twilioError,
      twilioErrorMessage: twilioMessage
    });
=======
    console.error('Error sending WhatsApp message:', error);
    throw new Error('Failed to send WhatsApp message');
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
  }
};

/**
 * Schedule a follow-up WhatsApp message
 * @param {string} to - Recipient's WhatsApp number
 * @param {string} message - Follow-up message
 * @param {number} delayMs - Delay in milliseconds
 */
export const scheduleFollowUpMessage = (to, message, delayMs) => {
  setTimeout(async () => {
    try {
      await sendWhatsAppMessage(to, message);
      console.log('Follow-up message sent successfully');
    } catch (error) {
      console.error('Failed to send follow-up message:', error);
    }
  }, delayMs);
};