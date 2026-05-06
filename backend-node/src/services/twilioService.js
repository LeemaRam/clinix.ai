import twilio from 'twilio';
import { env } from '../config/env.js';

const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

/**
 * Send a WhatsApp message using Twilio sandbox
 * @param {string} to - Recipient's WhatsApp number (e.g., 'whatsapp:+1234567890')
 * @param {string} message - Message content
 * @returns {Promise} Twilio message response
 */
export const sendWhatsAppMessage = async (to, message) => {
  try {
    const response = await client.messages.create({
      from: env.TWILIO_WHATSAPP_NUMBER,
      to: to,
      body: message
    });
    return response;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw new Error('Failed to send WhatsApp message');
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