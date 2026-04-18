# Stripe Architecture & Integration Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLINIX.AI ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

                         ┌──────────────┐
                         │   Frontend   │
                         │  (React/Ts)  │
                         └──────┬───────┘
                                │
                         /pricing page
                        /subscription/*
                                │
                    ┌───────────┴────────────┐
                    │                        │
            ┌───────▼────────┐      ┌────────▼──────────┐
            │   Node.js      │      │  Stripe.com       │
            │   Backend      │      │  (SaaS)           │
            │   (Express)    │      │                   │
            └───┬─────────┬──┘      └────┬──────────┬──┘
                │         │               │          │
         ┌──────▼─┐   ┌───▼──────┐   ┌───▼─────┐ ┌──▼───┐
         │MongoDB │   │Python AI │   │Webhooks │ │Cards │
         │        │   │Service   │   │         │ │      │
         └────────┘   └──────────┘   └─────────┘ └──────┘
```

## Payment Flow

### 1. User Subscribes

```
User clicks "Subscribe" on Pricing page
                    │
                    ▼
         Frontend calls backend:
    POST /api/subscriptions/checkout
         { planId, successUrl, cancelUrl }
                    │
                    ▼
         Backend fetches plan from MongoDB
         Backend creates Stripe checkout session
         Backend returns { sessionId, url }
                    │
                    ▼
    Frontend redirects to Stripe checkout
              window.location.href = url
                    │
                    ▼
         User fills in card details
         User clicks "Pay"
                    │
                    ▼
      Stripe processes payment + creates subscription
```

### 2. Payment Success (Webhook)

```
Stripe sends webhook event:
    type: "checkout.session.completed"
                    │
                    ▼
Backend receives webhook at:
    POST /api/subscriptions/webhook
                    │
        ▼─────────────────────────┐
        │ (signature verified)     │
        │ (body reconstructed)     │
                    │
                    ▼
    Handler: handleSubscriptionCreated()
                    │
        ┌───────────┴──────────────┐
        │                          │
        ▼                          ▼
Save UserSubscription    Stripe subscription details
to MongoDB               (customer ID, subscription ID, dates)
       │
       ▼
User is now subscribed!
```

### 3. User Cancels at Period End

```
User clicks "Cancel Subscription"
                    │
                    ▼
Frontend calls backend:
    POST /api/subscriptions/cancel
                    │
                    ▼
Backend sets:
    cancelAtPeriodEnd = true
    in MongoDB UserSubscription
                    │
                    ▼
Subscription expires on current_period_end date
Then Stripe sends webhook:
    type: "customer.subscription.deleted"
                    │
                    ▼
Backend receives + processes cancellation
    Marks subscription as "cancelled"
```

## Data Flow: Stripe to MongoDB

### Creating a Subscription

```javascript
// What Stripe sends
Stripe Checkout Session:
{
  id: "cs_live_xxxxx",
  customer: "cus_xxxxx",        // Stripe customer ID
  subscription: "sub_xxxxx",    // Stripe subscription ID
  client_reference_id: "user_id",
  metadata: {
    planId: "mongo_plan._id",
    userId: "mongo_user._id"
  }
}

// What we save to MongoDB
UserSubscription:
{
  userId: ObjectId("mongo_user._id"),
  planId: ObjectId("mongo_plan._id"),
  stripeSubscriptionId: "sub_xxxxx",    // Link to Stripe
  stripeCustomerId: "cus_xxxxx",        // Link to Stripe
  status: "active",
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Payment Succeeded

```javascript
// Stripe sends
Invoice:
{
  subscription: "sub_xxxxx",
  status: "paid",
  period_start: 1234567890,
  period_end: 1235172690
}

// We update MongoDB
UserSubscription:
{
  stripeSubscriptionId: "sub_xxxxx",
  // Update these fields:
  status: "active",
  currentPeriodStart: new Date(period_start * 1000),
  currentPeriodEnd: new Date(period_end * 1000),
  updatedAt: new Date()
}
```

## Subscription State Machine

```
┌─────────────┐
│   Active    │ ◄─── Default state after successful payment
└──────┬──────┘
       │
       │ (payment fails)
       ▼
┌──────────────┐
│  Past Due    │ ◄─── Invoice payment failed
└──────┬───────┘
       │
       │ (payment succeeds after retry)
       ├─────────────────────────────┐
       │                             │
       ▼                             ▼
   Active              (stay in past_due until paid)
       
       │ (user clicks Cancel)
       ▼
┌──────────────┐
│Cancel Pending│ ◄─── cancelAtPeriodEnd = true
└──────┬───────┘      (but still active until period end)
       │
       │ (period ends OR subscription deleted in Stripe)
       ▼
┌──────────────┐
│  Cancelled   │ ◄─── Subscription ended
└──────────────┘
```

## Key Integration Points

### 1. In React Frontend

**File**: `src/pages/Pricing.tsx`

```typescript
const handleSubscribe = async (plan) => {
  // 1. Send plan ID to backend
  const checkoutSession = await userSubscriptionApi.createCheckoutSession({
    planId: plan.id,
    successUrl: "http://localhost:3000/subscription/success",
    cancelUrl: "http://localhost:3000/pricing"
  });
  
  // 2. Stripe redirects user to checkout
  window.location.href = checkoutSession.url;
  
  // 3. After payment, user redirected to successUrl
};
```

### 2. In Node.js Backend

**File**: `src/controllers/subscriptionController.js`

```javascript
// Create checkout session
export const createCheckoutSession = async (req, res) => {
  const { planId } = req.body;
  
  // Get plan from MongoDB
  const plan = await SubscriptionPlan.findById(planId);
  
  // Create Stripe session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price: plan.stripePriceId,  // Link to Stripe product
      quantity: 1
    }],
    mode: 'subscription',
    client_reference_id: req.user.id,  // Track user
    metadata: {
      planId: planId,              // Track plan
      userId: req.user.id
    }
  });
  
  // Return URL to redirect user
  res.json({ sessionId: session.id, url: session.url });
};

// Handle webhook from Stripe
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // Reconstruct event with signature verification
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  // Process event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleSubscriptionCreated(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object);
      break;
  }
};
```

### 3. In Stripe Dashboard

When you create a product/price:
- **Stripe stores**: Product, Price, Customer, Subscription
- **We store**: SubscriptionPlan (with stripePriceId), UserSubscription (with stripeSubscriptionId)
- **Link**: stripePriceId connects MongoDB plan to Stripe price

## Database Schema Dependencies

```
Stripe.com              MongoDB (clinix_ai database)
==========              =============================

Product ──────────────┐
  │                   │
  └── Price           │
       (price_xxx) ───┼──► SubscriptionPlan
                      │    {
                      │      stripePriceId: "price_xxx",
Customer              │      name, price, features, etc.
  │                   │    }
  └── Subscription────┼──────────────┐
       (sub_xxx) ─────┼──► UserSubscription
                      │    {
                      │      stripeSubscriptionId: "sub_xxx",
                      │      stripeCustomerId: "cus_xxx",
                      │      userId: ObjectId,
                      │      planId: ObjectId,
                      │      status, dates, etc.
                      │    }
                      │
                      └──► User
                           { _id, email, name, etc. }
```

## Environment Variables Flow

```
.env (development)
└─ STRIPE_SECRET_KEY = sk_test_xxx
└─ STRIPE_WEBHOOK_SECRET = whsec_xxx
└─ STRIPE_SUCCESS_URL = http://localhost:3000/subscription/success
└─ STRIPE_CANCEL_URL = http://localhost:3000/subscription/cancel

  │
  ▼ (loaded by Express)

subscriptionController.js
  │
  ├─ stripe.checkout.sessions.create()
  ├─ stripe.subscriptions.retrieve()
  ├─ stripe.webhooks.constructEvent()
  └─ stripe.??? (any Stripe API call)

  │
  ▼ (in responses)

Frontend
  │
  └─ Redirects to ${STRIPE_SUCCESS_URL}
```

## Webhook Signature Verification

```
Stripe sends:
┌────────────────────────────┐
│ POST /api/subscriptions/   │
│ webhook                    │
├────────────────────────────┤
│ Headers:                   │
│ stripe-signature: <sig>    │
├────────────────────────────┤
│ Body: JSON event data      │
└────────────────────────────┘
           │
           ▼
Backend reconstructs event:
const event = stripe.webhooks.constructEvent(
  body,                    // Raw body bytes
  signature,              // From stripe-signature header
  endpointSecret         // STRIPE_WEBHOOK_SECRET from .env
);

     This verifies:
     1. Body wasn't modified
     2. Came from Stripe (not attacker)
     3. Is recent (prevents replay attacks)
           │
           ▼
     event.type === "checkout.session.completed"
     event.data.object === {
       id, customer, subscription,
       client_reference_id, metadata, ...
     }
```

## Expansion: Payment Retry Flow

Future enhancement possibility:

```
Payment Failed
      │
      ▼
Invoice marked as open_status
      │
      ├─ Auto-retry (Stripe default: 3 attempts)
      │
      ├─ Stripe sends: invoice.payment_failed webhook
      │  (if we implement it)
      │
      ├─ Update MongoDB: UserSubscription.status = "past_due"
      │
      ├─ Frontend shows warning
      │
      └─ User updates payment method
           │
           ▼
        Retry successful
           │
           ▼
        Stripe sends: invoice.payment_succeeded
           │
           ▼
        Update MongoDB: status = "active"
           │
           ▼
        Service restored!
```

## Scaling Considerations

### Current Approach (Single Stripe Account)
- ✅ Simple setup
- ✅ Good for MVP/FYP
- ⚠️  Limited to one business entity

### For Multi-Tenant Future
- Stripe Connect sub-accounts
- Separate Stripe accounts per tenant
- Custom splitting logic

### Current Limits (Stripe Free)
- ✅ No transaction fees in test mode
- ✅ Unlimited test transactions
- ⚠️  Live mode: Standard Stripe fees (2.9% + $0.30)
- ⚠️  No charge in Live mode until you activate

## Testing Scenarios

### Scenario 1: Successful Payment
```
Card: 4242 4242 4242 4242
Result: Charge succeeds
        webhook: checkout.session.completed
        MongoDB: UserSubscription created
        Frontend: Redirect to /subscription/success
```

### Scenario 2: Insufficient Funds
```
Card: 4000 0000 0000 0002
Result: Charge declined
        No webhook sent
        Frontend: Error message
        MongoDB: No record created
```

### Scenario 3: Already Failed
```
User pays ($79), subscription active
7 days later...
User's card is declined for renewal
        webhook: invoice.payment_failed
        MongoDB: status = "past_due"
        Service: Limited functionality
```

## Troubleshooting Table

| Problem | Root Cause | Solution |
|---------|-----------|----------|
| "Webhook signature verification failed" | STRIPE_WEBHOOK_SECRET doesn't match | Get fresh signing secret from Stripe → Webhooks |
| "Cannot read stripePriceId" | Price ID missing from MongoDB | Run `npm run seed:stripe` with correct IDs |
| User not redirected to Stripe | STRIPE_SUCCESS_URL invalid | Check URL is accessible from browser |
| Subscription not saving | Database error | Check MongoDB connection; verify planId/userId exist |
| Test card declined | Using wrong card number | Use exactly: 4242 4242 4242 4242 |

## References

- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Testing](https://stripe.com/docs/testing)
