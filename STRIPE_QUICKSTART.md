# Stripe Quick Start Guide

Get Stripe payments working in Clinix.ai in 10 minutes.

## Step 1: Create Stripe Account (2 minutes)

1. Visit https://stripe.com and click **Start now**
2. Sign up with your email
3. Confirm email
4. You're in! ✅

## Step 2: Get Your Secret Key (1 minute)

1. Go to **Stripe Dashboard** → https://dashboard.stripe.com
2. Click **Developers** (top right menu)
3. Click **API Keys** (left sidebar)
4. Copy **Secret Key** (starts with `sk_test_`)
5. ✅ You got it!

## Step 3: Create Stripe Products (4 minutes)

In Stripe Dashboard:

### Starter Monthly
1. **Products** → **+ Add product**
2. Name: `Starter`
3. Price: `29` USD
4. Billing: `Monthly`
5. **Create product** → Copy **Price ID** (starts with `price_`)

### Pro Monthly
1. **+ Add product**
2. Name: `Pro`
3. Price: `79` USD
4. Billing: `Monthly`
5. **Create product** → Copy **Price ID**

### Starter Yearly
1. **+ Add product**
2. Name: `Starter Yearly`
3. Price: `290` USD
4. Billing: `Yearly`
5. **Create product** → Copy **Price ID**

### Pro Yearly
1. **+ Add product**
2. Name: `Pro Yearly`
3. Price: `790` USD
4. Billing: `Yearly`
5. **Create product** → Copy **Price ID**

**Save all 4 Price IDs!** 🔑

## Step 4: Configure Backend (2 minutes)

Update `backend-node/.env`:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=placeholder_for_now
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
```

## Step 5: Seed Database (1 minute)

1. Open `backend-node/seed-stripe-plans.js`
2. Find the `STRIPE_PRICE_IDS` object
3. Paste your 4 Price IDs:
   ```javascript
   const STRIPE_PRICE_IDS = {
     starter_monthly: 'price_xxxxx_from_step3',
     pro_monthly: 'price_xxxxx_from_step3',
     starter_yearly: 'price_xxxxx_from_step3',
     pro_yearly: 'price_xxxxx_from_step3'
   };
   ```
4. Save file
5. Run in terminal:
   ```bash
   cd backend-node
   npm install  # if you haven't
   npm run seed:stripe
   ```
6. You should see:
   ```
   ✨ Successfully seeded subscription plans:
     1. Starter - $29/month
     2. Pro - $79/month
     3. Starter - $290/year
     4. Pro - $790/year
   ```

## Step 6: Start Services

```bash
# Terminal 1: Backend
cd backend-node
npm start

# Terminal 2: AI Service  
cd ai-service
python -m uvicorn app.main:app --port 8001

# Terminal 3: Frontend
cd frontend
npm run dev
```

## Step 7: Test It! 🎉

1. Go to http://localhost:3000/pricing
2. Click **Subscribe** on any plan
3. Use test card: `4242 4242 4242 4242`
4. Expiry: `12/25` (any future date)
5. CVC: `123` (any 3 digits)
6. Click **Pay**
7. ✅ Success page shows!

## That's It! 🚀

Your Stripe integration is working!

## Common Issues

**"Invalid plan or missing Stripe price ID"**
- Did you update `seed-stripe-plans.js` with all 4 Price IDs?
- Run the seed command again: `npm run seed:stripe`

**Redirect to Stripe doesn't work**
- Is backend running on `http://localhost:5000`?
- Check console for network errors

**Test card declined**
- Use exactly: `4242 4242 4242 4242`
- Expiry must be in future: `12/25`
- CVC can be any 3 digits

## Need More Details?

See full guides:
- **[STRIPE_SETUP.md](../STRIPE_SETUP.md)** - Comprehensive setup
- **[STRIPE_CHECKLIST.md](../STRIPE_CHECKLIST.md)** - Implementation checklist
- **[STRIPE_FRONTEND.md](../STRIPE_FRONTEND.md)** - Frontend integration

## Production Setup

To deploy to Azure with live payments:

1. In Stripe Dashboard, switch to **Live Mode**
2. Copy **Live Secret Key** (starts with `sk_live_`)
3. Create same products again in Live mode
4. Copy Live Price IDs
5. In Azure Portal → App Service → Configuration:
   - Add `STRIPE_SECRET_KEY` = `sk_live_YOUR_KEY`
   - Update Price IDs in MongoDB
6. Set up webhook for Azure URL

See **[STRIPE_SETUP.md](../STRIPE_SETUP.md)** Phase 8-10 for details.

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe Support: https://stripe.com/support
- Clinix.ai Issues: GitHub issues

Happy coding! 💙
