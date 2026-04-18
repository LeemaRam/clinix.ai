import express, { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import {
  cancelSubscription,
  comparePlans,
  createCheckoutSession,
  getPlan,
  getPublicPlans,
  getUserSubscription,
  handleStripeWebhook,
  reactivateSubscription,
  verifySubscription
} from '../controllers/subscriptionController.js';

const router = Router();

router.get('/subscription/plans', getPublicPlans);
router.get('/subscription/plans/:id', getPlan);
router.post('/subscription/plans/compare', comparePlans);
router.get('/user/subscription', authRequired, getUserSubscription);
router.post('/subscription/create-checkout-session', authRequired, createCheckoutSession);
router.get('/verify-subscription', authRequired, verifySubscription);
router.post('/cancel-subscription', authRequired, cancelSubscription);
router.post('/reactivate-subscription', authRequired, reactivateSubscription);

// Stripe webhook - no auth required, uses signature verification
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
