export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'trial';
  transcriptionsPerMonth: number;
  diskSpaceGB: number;
  features: string[];
  stripePriceId: string;
  popular?: boolean;
  active: boolean;
  trial_days?: number;
  admin_only?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  transcriptionsUsed: number;
  diskSpaceUsedGB: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionUsage {
  transcriptionsUsed: number;
  transcriptionsLimit: number;
  diskSpaceUsedGB: number;
  diskSpaceLimitGB: number;
  resetDate: Date;
}

export interface CreatePlanRequest {
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'trial';
  transcriptionsPerMonth: number;
  diskSpaceGB: number;
  features: string[];
  trial_days?: number;
  admin_only?: boolean;
}

export interface CreateUserWithSubscriptionRequest {
  full_name: string;
  email: string;
  password: string;
  role: string;
  subscription_plan_id?: string;
}

export interface CheckoutSessionRequest {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface PlanStatistics {
  active_subscriptions: number;
  total_subscriptions: number;
  monthly_revenue: number;
  signup_trend: any[];
}

export interface PaginatedPlansResponse {
  plans: SubscriptionPlan[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
} 