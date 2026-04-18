# Stripe Frontend Integration

## Overview

The frontend Stripe integration is already implemented in:
- `src/pages/Pricing.tsx` - Pricing page with subscription plans
- `src/services/subscriptionService.ts` - API client for subscription operations
- `src/pages/SubscriptionSuccess.tsx` - Success redirect page
- `src/pages/SubscriptionCancel.tsx` - Cancellation redirect page

## Current Implementation

### Pricing Page (`src/pages/Pricing.tsx`)

Features:
- Displays all available subscription plans
- Filters by billing interval (monthly/yearly)
- Shows plan details: features, price, transcription limits
- Subscribe button that creates Stripe checkout session
- Handles authenticated and unauthenticated users

```tsx
const handleSubscribe = async (plan: SubscriptionPlan) => {
  if (!user) {
    toast.error(t('auth.pleaseLoginToSubscribe'));
    return;
  }

  const request: CheckoutSessionRequest = {
    planId: plan.id,
    successUrl: `${window.location.origin}/subscription/success`,
    cancelUrl: `${window.location.origin}/pricing`
  };

  const checkoutSession = await userSubscriptionApi.createCheckoutSession(request);
  window.location.href = checkoutSession.url; // Redirect to Stripe
};
```

### Subscription Service (`src/services/subscriptionService.ts`)

API client methods:
- `getAvailablePlans()` - Fetch all subscription plans
- `getPlanById(id)` - Get specific plan details
- `comparePlans(ids)` - Compare multiple plans
- `createCheckoutSession(request)` - Create Stripe checkout
- `getUserSubscription()` - Get user's active subscription
- `cancelSubscription()` - Cancel at period end
- `reactivateSubscription()` - Reactivate cancelled subscription

### Success Page (`src/pages/SubscriptionSuccess.tsx`)

After successful payment:
- Displays confirmation message
- Shows subscription details
- Redirect option to dashboard

### Cancel Page (`src/pages/SubscriptionCancel.tsx`)

If user cancels Stripe checkout:
- Displays cancellation message
- Option to return to pricing page

## What's Already Done ✓

- [x] Pricing page UI with plan display
- [x] Plan filtering (monthly/yearly)
- [x] Subscribe button with checkout session creation
- [x] Stripe redirect integration
- [x] Success/cancel redirect handlers
- [x] User authentication check
- [x] Loading states and error handling
- [x] Toast notifications
- [x] i18n translations (if configured)

## What Needs Configuration

### 1. Environment Variables

Update `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
# Stripe is configured server-side, no publishable key needed in frontend
```

### 2. Ensure API URLs Are Correct

Check `src/services/subscriptionService.ts` endpoints:
```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SUBSCRIPTION_API = `${API_BASE}/api/subscriptions`;
```

### 3. Test Stripe Checkout Flow

1. Start frontend: `npm run dev`
2. Navigate to `/pricing`
3. Click Subscribe button
4. You'll be redirected to Stripe Checkout
5. Use test card: `4242 4242 4242 4242`
6. Complete payment
7. Success page should show

## Frontend Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/pricing` | Pricing.tsx | Browse & subscribe to plans |
| `/subscription/success` | SubscriptionSuccess.tsx | Show after successful payment |
| `/subscription/cancel` | SubscriptionCancel.tsx | Show if user cancels checkout |
| `/subscription/management` | SubscriptionManagement.tsx | Manage active subscription |

## Type Safety

Subscription types in `src/types/subscription.ts`:

```typescript
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
  transcriptionsPerMonth: number;
  diskSpaceGB: number;
  popular: boolean;
  trial_days: number;
}

export interface CheckoutSessionRequest {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}
```

## Authentication

All subscription endpoints require JWT authentication via `Authorization` header:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

The `apiFetch` utility automatically includes this from AuthContext.

## Error Handling

The subscription service includes error handling:
- Network errors → Toast notification
- Invalid plans → Error message
- Unauthenticated requests → Redirect to login

## Mobile Responsiveness

Pricing page is fully responsive:
- Mobile: Vertical plan cards
- Tablet: 2-column layout
- Desktop: 2-4 column layout with full details

Uses Tailwind CSS responsive classes:
- `sm:` (640px+)
- `md:` (768px+)
- `lg:` (1024px+)

## Stripe Test Cards

For testing in the Pricing page:

| Card Number | Use Case |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Declined payment |
| 5555 5555 5555 4444 | Mastercard test |

Expiry: Any future date
CVC: Any 3 digits

## Next Steps

1. **Verify Backend Connection**
   - Start backend with Stripe keys configured
   - Ensure `/api/subscriptions` endpoints are available

2. **Test End-to-End**
   - Navigate to pricing page
   - Subscribe to a plan
   - Complete Stripe checkout
   - Verify success page shows

3. **Check Webhook Integration**
   - Verify MongoDB receives subscription record
   - Confirm webhook events are processed

4. **Production Deployment**
   - Update `VITE_API_URL` to Azure backend URL
   - Test pricing page on production domain
   - Verify Stripe webhook is configured for production

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Plan not found" at checkout | Verify MongoDB seeding with correct Price IDs |
| Redirect to Stripe fails | Check backend is running and `/api/subscriptions` is accessible |
| Success page blank | Verify `VITE_API_URL` environment variable is set correctly |
| Stripe card declined | Use test card 4242 4242 4242 4242, or check Stripe dashboard for error details |

## Additional Customization

### Change Plan Display
Edit `src/pages/Pricing.tsx` to customize:
- Plan card styling
- Feature icons
- Price formatting
- CTA button text

### Modify Success Message
Edit `src/pages/SubscriptionSuccess.tsx` to:
- Show additional subscription details
- Add email or document download
- Customize next steps

### Add More Endpoints
Extend `subscriptionService.ts` for:
- Usage tracking
- Invoice history
- Upgrade/downgrade plans
- Team management

## References

- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
