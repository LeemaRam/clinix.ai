# Stripe Integration Checklist

## Phase 1: Create Stripe Account & Get API Keys ✓

- [ ] Create Stripe account at https://stripe.com
- [ ] Go to Stripe Dashboard → Developers → API Keys
- [ ] Copy **Secret Key** (Test mode: starts with `sk_test_`)
- [ ] Copy **Publishable Key** (Test mode: starts with `pk_test_`)

## Phase 2: Create Products in Stripe ✓

Create 4 products in Stripe Dashboard → Products → Add product:

### Monthly Plans
- [ ] **Starter Monthly**
  - Price: $29/month
  - Billing: Monthly recurring
  - Copy the **Price ID** (starts with `price_`)
  
- [ ] **Pro Monthly**
  - Price: $79/month
  - Billing: Monthly recurring
  - Copy the **Price ID**

### Yearly Plans
- [ ] **Starter Yearly**
  - Price: $290/year
  - Billing: Yearly recurring
  - Copy the **Price ID**
  
- [ ] **Pro Yearly**
  - Price: $790/year
  - Billing: Yearly recurring
  - Copy the **Price ID**

## Phase 3: Configure Backend Environment ✓

- [ ] Update `backend-node/.env`:
```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
```

- [ ] Update `docker-compose.yml` with Stripe env variables
- [ ] Create `.env.docker` for containerized deployment

## Phase 4: Seed MongoDB with Plans ✓

- [ ] Copy all 4 Stripe **Price IDs** from Phase 2
- [ ] Update `backend-node/seed-stripe-plans.js` with Price IDs in `STRIPE_PRICE_IDS` object
- [ ] Run seeder:
```bash
cd backend-node
npm install  # if not done
npm run seed:stripe
```

Expected output:
```
✨ Successfully seeded subscription plans:
  1. Starter - $29/month
     Stripe Price: price_XXXXX
  2. Pro - $79/month
     Stripe Price: price_XXXXX
  3. Starter - $290/year
     Stripe Price: price_XXXXX
  4. Pro - $790/year
     Stripe Price: price_XXXXX
```

## Phase 5: Set Up Webhook ✓

- [ ] Stripe Dashboard → Developers → Webhooks → Add endpoint
- [ ] Endpoint URL for local: `http://localhost:5000/api/subscriptions/webhook`
- [ ] Select events:
  - [ ] `checkout.session.completed`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
  - [ ] `customer.subscription.deleted`
- [ ] Copy **Signing secret** (starts with `whsec_`)
- [ ] Add to `backend-node/.env` as `STRIPE_WEBHOOK_SECRET`

## Phase 6: Test Locally ✓

- [ ] Start backend: `npm start`
- [ ] Start AI service: `python app/main.py`
- [ ] Start frontend: `npm run dev`
- [ ] Go to http://localhost:3000/pricing
- [ ] Click Subscribe on any plan
- [ ] Use Stripe test card: `4242 4242 4242 4242`
  - Expiry: Any future date (e.g., 12/25)
  - CVC: Any 3 digits (e.g., 123)
- [ ] Verify redirect to success page
- [ ] Check Stripe Dashboard for completed payment

## Phase 7: Test Webhook (Optional) ✓

- [ ] Install Stripe CLI from https://stripe.com/docs/stripe-cli
- [ ] Login: `stripe login`
- [ ] Forward webhooks: `stripe listen --forward-to localhost:5000/api/subscriptions/webhook`
- [ ] In another terminal, trigger test: `stripe trigger checkout.session.completed`
- [ ] Check MongoDB UserSubscription collection for new entry

## Phase 8: Prepare for Azure Deployment ✓

- [ ] Get **Live API Keys** from Stripe (production keys starting with `sk_live_` and `pk_live_`)
- [ ] Create Stripe products again with **Live mode** (same prices, same names)
- [ ] Copy all 4 **Live Price IDs**
- [ ] Create `.env.production` for Azure:
```env
STRIPE_SECRET_KEY=sk_live_YOUR_PRODUCTION_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_PRODUCTION_WEBHOOK
STRIPE_SUCCESS_URL=https://your-app.azurewebsites.net/subscription/success
STRIPE_CANCEL_URL=https://your-app.azurewebsites.net/subscription/cancel
```

## Phase 9: Deploy to Azure ✓

- [ ] Push code to Azure (Git or Docker)
- [ ] Configure application settings in Azure Portal:
  - [ ] STRIPE_SECRET_KEY
  - [ ] STRIPE_WEBHOOK_SECRET
  - [ ] STRIPE_SUCCESS_URL (with your Azure domain)
  - [ ] STRIPE_CANCEL_URL (with your Azure domain)
- [ ] Update webhook in Stripe Dashboard for Azure URL
  - [ ] Endpoint: `https://your-app.azurewebsites.net/api/subscriptions/webhook`
  - [ ] Copy new signing secret
  - [ ] Update STRIPE_WEBHOOK_SECRET in Azure

## Phase 10: Test Production ✓

- [ ] Go to https://your-app.azurewebsites.net/pricing
- [ ] Click Subscribe and test with Stripe test card
- [ ] Verify webhook receives Stripe events
- [ ] Check MongoDB for UserSubscription entries

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid plan or missing Stripe price ID" | Verify Price IDs in `seed-stripe-plans.js` and in MongoDB |
| "Webhook signature verification failed" | Check STRIPE_WEBHOOK_SECRET matches Stripe signing secret exactly |
| Stripe key not found | Verify `.env` exists and has STRIPE_SECRET_KEY |
| Payment redirect fails | Check STRIPE_SUCCESS_URL and STRIPE_CANCEL_URL are valid |
| MongoDB connection fails | Ensure MongoDB is running and MONGODB_URI is correct |

## Quick Reference

### Key Files
- **Seeder**: `backend-node/seed-stripe-plans.js`
- **Controller**: `backend-node/src/controllers/subscriptionController.js`
- **Documentation**: `STRIPE_SETUP.md`
- **Env Template**: `backend-node/.env.example`

### API Endpoints
- `GET /api/subscriptions/plans` - List all plans
- `POST /api/subscriptions/checkout` - Create checkout session
- `POST /api/subscriptions/webhook` - Stripe webhook

### Stripe Resources
- Dashboard: https://dashboard.stripe.com
- API Docs: https://stripe.com/docs/api
- Test Cards: https://stripe.com/docs/testing
