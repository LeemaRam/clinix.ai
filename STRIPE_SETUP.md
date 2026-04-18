# Stripe Integration Setup Guide

This guide walks you through setting up Stripe payments for Clinix.ai subscription management.

## Prerequisites

- Stripe account (create one at https://stripe.com)
- Node.js backend running with the subscription controller
- Frontend subscription pages configured

## Step 1: Get Your Stripe API Keys

1. Go to **Stripe Dashboard** → https://dashboard.stripe.com
2. Log in to your Stripe account
3. Navigate to **Developers** → **API keys** (left sidebar)
4. You'll see two sets of keys:
   - **Test Mode** (for development) - Keys prefixed with `pk_test_` and `sk_test_`
   - **Live Mode** (for production) - Keys prefixed with `pk_live_` and `sk_live_`

### For Development (Local & Docker):
- Copy the **Test Secret Key** (starts with `sk_test_`)
- Copy the **Test Publishable Key** (starts with `pk_test_`)

### For Production (Azure):
- Copy the **Live Secret Key** (starts with `sk_live_`)
- Copy the **Live Publishable Key** (starts with `pk_live_`)

## Step 2: Create Stripe Products & Prices

1. In **Stripe Dashboard**, go to **Products** (left sidebar)
2. Click **+ Add product** for each plan:

### Starter Plan (Monthly)
- **Name**: Starter
- **Price**: $29/month
- **Billing period**: Monthly
- Click **Create product**
- Copy the **Price ID** (starts with `price_`)

### Pro Plan (Monthly)
- **Name**: Pro
- **Price**: $79/month
- **Billing period**: Monthly
- Click **Create product**
- Copy the **Price ID**

### Starter Plan (Yearly)
- **Name**: Starter Yearly
- **Price**: $290/year
- **Billing period**: Yearly
- Click **Create product**
- Copy the **Price ID**

### Pro Plan (Yearly)
- **Name**: Pro Yearly
- **Price**: $790/year
- **Billing period**: Yearly
- Click **Create product**
- Copy the **Price ID**

## Step 3: Configure Environment Variables

### Backend (.env)

Update `backend-node/.env`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
```

### For Docker Deployment

Update `docker-compose.yml` - add to backend service:

```yaml
environment:
  - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
  - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
  - STRIPE_SUCCESS_URL=${STRIPE_SUCCESS_URL}
  - STRIPE_CANCEL_URL=${STRIPE_CANCEL_URL}
```

Create a `.env.docker` file in the root:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
STRIPE_SUCCESS_URL=https://yourdomain.com/subscription/success
STRIPE_CANCEL_URL=https://yourdomain.com/subscription/cancel
```

Run with:
```bash
docker-compose --env-file .env.docker up
```

## Step 4: Set Up Webhook

Webhooks allow Stripe to notify your backend of payment events.

1. In **Stripe Dashboard**, go to **Developers** → **Webhooks**
2. Click **+ Add endpoint**
3. Enter your endpoint URL:
   - **Local**: `http://localhost:5000/api/subscriptions/webhook`
   - **Azure**: `https://your-app.azurewebsites.net/api/subscriptions/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your `.env` as `STRIPE_WEBHOOK_SECRET`

## Step 5: Seed Product Data in MongoDB

The subscription controller uses both Stripe and MongoDB. Add subscription plans to your database:

```javascript
// Run this in your MongoDB admin panel or create a seed script
db.subscriptionplans.insertMany([
  {
    name: "Starter",
    description: "For solo practitioners getting started.",
    price: 29,
    currency: "usd",
    interval: "month",
    transcriptionsPerMonth: 120,
    diskSpaceGB: 10,
    features: ["AI transcription", "SOAP reports", "Basic analytics"],
    stripePriceId: "price_YOUR_STARTER_MONTHLY_PRICE_ID",
    popular: false,
    trialDays: 14,
    active: true,
    deleted: false
  },
  {
    name: "Pro",
    description: "For growing clinics with higher volume.",
    price: 79,
    currency: "usd",
    interval: "month",
    transcriptionsPerMonth: 600,
    diskSpaceGB: 80,
    features: ["Everything in Starter", "Priority processing", "Team support"],
    stripePriceId: "price_YOUR_PRO_MONTHLY_PRICE_ID",
    popular: true,
    trialDays: 14,
    active: true,
    deleted: false
  },
  {
    name: "Starter",
    description: "For solo practitioners getting started.",
    price: 290,
    currency: "usd",
    interval: "year",
    transcriptionsPerMonth: 120,
    diskSpaceGB: 10,
    features: ["AI transcription", "SOAP reports", "Basic analytics"],
    stripePriceId: "price_YOUR_STARTER_YEARLY_PRICE_ID",
    popular: false,
    trialDays: 14,
    active: true,
    deleted: false
  },
  {
    name: "Pro",
    description: "For growing clinics with higher volume.",
    price: 790,
    currency: "usd",
    interval: "year",
    transcriptionsPerMonth: 600,
    diskSpaceGB: 80,
    features: ["Everything in Starter", "Priority processing", "Team support"],
    stripePriceId: "price_YOUR_PRO_YEARLY_PRICE_ID",
    popular: true,
    trialDays: 14,
    active: true,
    deleted: false
  }
]);
```

## Step 6: Test the Integration

### Using Stripe Test Cards

Stripe provides test card numbers for development:

- **Successful payment**: `4242 4242 4242 4242`
- **Declined payment**: `4000 0000 0000 0002`
- **Expiry date**: Any future date (e.g., 12/25)
- **CVC**: Any 3 digits (e.g., 123)

1. Start your application:
```bash
npm run dev          # Frontend
npm start            # Backend
python app/main.py   # AI Service
```

2. Go to **Pricing** page (`http://localhost:3000/pricing`)
3. Click **Subscribe** on a plan
4. You'll be redirected to Stripe Checkout
5. Enter test card `4242 4242 4242 4242`
6. Fill in any future expiry and any CVC
7. Click **Pay**
8. You should see a success redirect

### Webhook Testing (Optional)

To test webhooks locally, use Stripe CLI:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli

# Login to your account
stripe login

# Forward webhooks to your local endpoint
stripe listen --forward-to localhost:5000/api/subscriptions/webhook

# Make a test event
stripe trigger checkout.session.completed
```

## Step 7: Verify Routes Are Protected

The subscription endpoints are protected by JWT authentication. Make sure:

1. Users are authenticated before accessing `/api/subscriptions/`
2. Token is included in request headers: `Authorization: Bearer YOUR_JWT_TOKEN`

## Step 8: Azure Deployment

### Environment Variables in Azure

1. Go to **Azure Portal** → Your App Service
2. **Settings** → **Configuration** → **New application setting**
3. Add:
   - `STRIPE_SECRET_KEY` = `sk_live_YOUR_PRODUCTION_KEY`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_YOUR_WEBHOOK_SECRET`
   - `STRIPE_SUCCESS_URL` = `https://your-clinix-app.azurewebsites.net/subscription/success`
   - `STRIPE_CANCEL_URL` = `https://your-clinix-app.azurewebsites.net/subscription/cancel`

### Update Webhook in Production

1. In **Stripe Dashboard**, create a new webhook endpoint for your Azure URL
2. Use this webhook secret in Azure configuration

## Troubleshooting

### "Invalid plan or missing Stripe price ID"
- Verify `stripePriceId` in MongoDB matches Stripe product price
- Ensure the price ID starts with `price_`

### "Webhook signature verification failed"
- Confirm `STRIPE_WEBHOOK_SECRET` matches exactly (get from Stripe → Webhooks)
- Check webhook endpoint URL is correct

### "Stripe key not found"
- Verify `.env` file has `STRIPE_SECRET_KEY`
- Restart backend after updating `.env`

### Payment redirect not working
- Check `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` are valid
- Verify frontend can access these routes

## API Endpoints

### Public Endpoints (No Auth)
- `GET /api/subscriptions/plans` - Get available subscription plans
- `GET /api/subscriptions/plans/:id` - Get specific plan
- `POST /api/subscriptions/compare` - Compare plans by IDs

### Protected Endpoints (Requires Auth)
- `POST /api/subscriptions/checkout` - Create Stripe checkout session
- `GET /api/subscriptions/user` - Get user's current subscription
- `POST /api/subscriptions/cancel` - Cancel subscription at period end
- `POST /api/subscriptions/reactivate` - Reactivate cancelled subscription
- `POST /api/subscriptions/webhook` - Stripe webhook (uses signature verification)

## Next Steps

1. ✅ Copy Stripe API keys to environment
2. ✅ Create products and prices in Stripe
3. ✅ Seed MongoDB with subscription plans
4. ✅ Test with Stripe test cards
5. ✅ Deploy to Azure with production keys
6. ✅ Update webhook endpoint in production

For more info, see [Stripe Documentation](https://stripe.com/docs)
