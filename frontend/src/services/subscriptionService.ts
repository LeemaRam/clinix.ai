import axios, { AxiosResponse } from 'axios';
import { 
  SubscriptionPlan, 
  UserSubscription, 
  SubscriptionUsage,
  CreatePlanRequest,
  CheckoutSessionRequest,
  CheckoutSession
} from '../types/subscription';

const API_URL = import.meta.env.VITE_API_URL;

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Handle API errors consistently
const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error || 
                   error.response?.data?.message || 
                   error.message || 
                   'An error occurred';
    return new Error(message);
  }
  return error instanceof Error ? error : new Error('An unexpected error occurred');
};

// Public subscription plans API (for pricing page)
export const subscriptionPlansApi = {
  // Get all active plans for public pricing page
  getAvailablePlans: async (): Promise<SubscriptionPlan[]> => {
    try {
      const response: AxiosResponse<{ plans: any[] }> = await axios.get(
        `${API_URL}/api/subscription/plans`
      );
      
      // Transform backend data to frontend format
      return response.data.plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        transcriptionsPerMonth: plan.transcriptionsPerMonth,
        diskSpaceGB: plan.diskSpaceGB,
        features: plan.features,
        stripePriceId: plan.stripePriceId || '',
        popular: plan.popular || false,
        active: true,
        trial_days: plan.trial_days,
        admin_only: plan.admin_only,
        createdAt: new Date(plan.createdAt || Date.now()),
        updatedAt: new Date(plan.updatedAt || Date.now())
      }));
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get specific plan details
  getPlanDetails: async (planId: string): Promise<SubscriptionPlan> => {
    try {
      const response: AxiosResponse<{ plan: any }> = await axios.get(
        `${API_URL}/api/subscription/plans/${planId}`
      );
      
      const plan = response.data.plan;
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        transcriptionsPerMonth: plan.transcriptionsPerMonth,
        diskSpaceGB: plan.diskSpaceGB,
        features: plan.features,
        stripePriceId: plan.stripePriceId || '',
        popular: plan.popular || false,
        active: plan.active,
        trial_days: plan.trial_days,
        admin_only: plan.admin_only,
        createdAt: new Date(plan.createdAt),
        updatedAt: new Date(plan.updatedAt)
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Compare multiple plans
  comparePlans: async (planIds: string[]): Promise<SubscriptionPlan[]> => {
    try {
      const response: AxiosResponse<{ plans: any[] }> = await axios.post(
        `${API_URL}/api/subscription/plans/compare`,
        { plan_ids: planIds }
      );
      
      return response.data.plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        transcriptionsPerMonth: plan.transcriptionsPerMonth,
        diskSpaceGB: plan.diskSpaceGB,
        features: plan.features,
        stripePriceId: plan.stripePriceId || '',
        popular: plan.popular || false,
        active: plan.active,
        trial_days: plan.trial_days,
        admin_only: plan.admin_only,
        createdAt: new Date(plan.createdAt),
        updatedAt: new Date(plan.updatedAt)
      }));
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

// User subscription management API
export const userSubscriptionApi = {
  // Get current user's subscription
  getCurrentSubscription: async (): Promise<{
    subscription: UserSubscription | null;
    plan: SubscriptionPlan | null;
    usage: SubscriptionUsage | null;
  }> => {
    try {
      const response: AxiosResponse<any> = await axios.get(
        `${API_URL}/api/user/subscription`,
        { headers: getAuthHeaders() }
      );
      
      const data = response.data;
      
      return {
        subscription: data.subscription ? {
          id: data.subscription.id,
          userId: data.subscription.userId,
          planId: data.subscription.planId,
          stripeSubscriptionId: data.subscription.stripeSubscriptionId,
          stripeCustomerId: data.subscription.stripeCustomerId,
          status: data.subscription.status,
          currentPeriodStart: new Date(data.subscription.currentPeriodStart),
          currentPeriodEnd: new Date(data.subscription.currentPeriodEnd),
          cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd,
          transcriptionsUsed: data.subscription.transcriptionsUsed,
          diskSpaceUsedGB: data.subscription.diskSpaceUsedGB,
          createdAt: new Date(data.subscription.createdAt),
          updatedAt: new Date(data.subscription.updatedAt)
        } : null,
        plan: data.plan ? {
          id: data.plan.id,
          name: data.plan.name,
          description: data.plan.description,
          price: data.plan.price,
          currency: data.plan.currency,
          interval: data.plan.interval,
          transcriptionsPerMonth: data.plan.transcriptionsPerMonth,
          diskSpaceGB: data.plan.diskSpaceGB,
          features: data.plan.features,
          stripePriceId: data.plan.stripePriceId,
          popular: data.plan.popular || false,
          active: data.plan.active,
          createdAt: new Date(data.plan.createdAt),
          updatedAt: new Date(data.plan.updatedAt)
        } : null,
        usage: data.usage ? {
          transcriptionsUsed: data.usage.transcriptionsUsed,
          transcriptionsLimit: data.usage.transcriptionsLimit,
          diskSpaceUsedGB: data.usage.diskSpaceUsedGB,
          diskSpaceLimitGB: data.usage.diskSpaceLimitGB,
          resetDate: new Date(data.usage.resetDate)
        } : null
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Create Stripe checkout session
  createCheckoutSession: async (request: CheckoutSessionRequest): Promise<CheckoutSession> => {
    try {
      const response: AxiosResponse<{ sessionId: string }> = await axios.post(
        `${API_URL}/api/subscription/create-checkout-session`,
        {
          planId: request.planId,
          successUrl: request.successUrl,
          cancelUrl: request.cancelUrl
        },
        { headers: getAuthHeaders() }
      );
      
      return {
        id: response.data.sessionId,
        url: `https://checkout.stripe.com/c/pay/${response.data.sessionId}`
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Verify subscription after Stripe checkout
  verifySubscription: async (sessionId: string): Promise<any> => {
    try {
      const response: AxiosResponse<any> = await axios.get(
        `${API_URL}/api/verify-subscription?session_id=${sessionId}`,
        { headers: getAuthHeaders() }
      );
      
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Cancel subscription
  cancelSubscription: async (): Promise<void> => {
    try {
      await axios.post(
        `${API_URL}/api/cancel-subscription`,
        {},
        { headers: getAuthHeaders() }
      );
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Reactivate subscription
  reactivateSubscription: async (): Promise<void> => {
    try {
      await axios.post(
        `${API_URL}/api/reactivate-subscription`,
        {},
        { headers: getAuthHeaders() }
      );
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

// Admin subscription plans management API
export const adminSubscriptionApi = {
  // Get all plans with admin details (pagination, search, etc.)
  getPlans: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'all' | 'active' | 'inactive';
  } = {}): Promise<{
    plans: SubscriptionPlan[];
    total: number;
    page: number;
    pages: number;
    hasMore: boolean;
  }> => {
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.search) queryParams.append('search', params.search);
      if (params.status) queryParams.append('status', params.status);

      const response: AxiosResponse<any> = await axios.get(
        `${API_URL}/api/super-admin/subscription-plans?${queryParams.toString()}`,
        { headers: getAuthHeaders() }
      );
      
      const data = response.data;
      return {
        plans: data.plans.map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          interval: plan.interval,
          transcriptionsPerMonth: plan.transcriptionsPerMonth,
          diskSpaceGB: plan.diskSpaceGB,
          features: plan.features,
          stripePriceId: plan.stripePriceId,
          popular: plan.popular || false,
          active: plan.active,
          trial_days: plan.trial_days,
          admin_only: plan.admin_only,
          createdAt: new Date(plan.created_at),
          updatedAt: new Date(plan.updated_at)
        })),
        total: data.total,
        page: data.page,
        pages: data.pages,
        hasMore: data.hasMore
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get specific plan with admin details
  getPlan: async (planId: string): Promise<{
    plan: SubscriptionPlan;
    statistics: {
      active_subscriptions: number;
      total_subscriptions: number;
      monthly_revenue: number;
      signup_trend: any[];
    };
  }> => {
    try {
      const response: AxiosResponse<any> = await axios.get(
        `${API_URL}/api/super-admin/subscription-plans/${planId}`,
        { headers: getAuthHeaders() }
      );
      
      const data = response.data;
      return {
        plan: {
          id: data.plan.id,
          name: data.plan.name,
          description: data.plan.description,
          price: data.plan.price,
          currency: data.plan.currency,
          interval: data.plan.interval,
          transcriptionsPerMonth: data.plan.transcriptionsPerMonth,
          diskSpaceGB: data.plan.diskSpaceGB,
          features: data.plan.features,
          stripePriceId: data.plan.stripePriceId,
          popular: data.plan.popular || false,
          active: data.plan.active,
          trial_days: data.plan.trial_days,
          admin_only: data.plan.admin_only,
          createdAt: new Date(data.plan.created_at),
          updatedAt: new Date(data.plan.updated_at)
        },
        statistics: data.plan.statistics
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Create new plan
  createPlan: async (planData: CreatePlanRequest): Promise<SubscriptionPlan> => {
    try {
      const response: AxiosResponse<{ plan: any }> = await axios.post(
        `${API_URL}/api/super-admin/subscription-plans`,
        planData,
        { headers: getAuthHeaders() }
      );
      
      const plan = response.data.plan;
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        transcriptionsPerMonth: plan.transcriptionsPerMonth,
        diskSpaceGB: plan.diskSpaceGB,
        features: plan.features,
        stripePriceId: plan.stripePriceId,
        popular: plan.popular || false,
        active: plan.active,
        trial_days: plan.trial_days,
        admin_only: plan.admin_only,
        createdAt: new Date(plan.created_at),
        updatedAt: new Date(plan.updated_at)
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update existing plan
  updatePlan: async (planId: string, planData: Partial<CreatePlanRequest>): Promise<SubscriptionPlan> => {
    try {
      const response: AxiosResponse<{ plan: any }> = await axios.put(
        `${API_URL}/api/super-admin/subscription-plans/${planId}`,
        planData,
        { headers: getAuthHeaders() }
      );
      
      const plan = response.data.plan;
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        transcriptionsPerMonth: plan.transcriptionsPerMonth,
        diskSpaceGB: plan.diskSpaceGB,
        features: plan.features,
        stripePriceId: plan.stripePriceId,
        popular: plan.popular || false,
        active: plan.active,
        trial_days: plan.trial_days,
        admin_only: plan.admin_only,
        createdAt: new Date(plan.created_at),
        updatedAt: new Date(plan.updated_at)
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Toggle plan active status
  togglePlanStatus: async (planId: string): Promise<{
    plan: SubscriptionPlan;
    message: string;
  }> => {
    try {
      const response: AxiosResponse<any> = await axios.patch(
        `${API_URL}/api/super-admin/subscription-plans/${planId}/toggle-status`,
        {},
        { headers: getAuthHeaders() }
      );
      
      const data = response.data;
      return {
        plan: {
          id: data.plan.id,
          name: data.plan.name,
          description: data.plan.description,
          price: data.plan.price,
          currency: data.plan.currency,
          interval: data.plan.interval,
          transcriptionsPerMonth: data.plan.transcriptionsPerMonth,
          diskSpaceGB: data.plan.diskSpaceGB,
          features: data.plan.features,
          stripePriceId: data.plan.stripePriceId,
          popular: data.plan.popular || false,
          active: data.plan.active,
          trial_days: data.plan.trial_days,
          admin_only: data.plan.admin_only,
          createdAt: new Date(data.plan.created_at),
          updatedAt: new Date(data.plan.updated_at)
        },
        message: data.message
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete plan
  deletePlan: async (planId: string): Promise<void> => {
    try {
      await axios.delete(
        `${API_URL}/api/super-admin/subscription-plans/${planId}`,
        { headers: getAuthHeaders() }
      );
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Duplicate plan
  duplicatePlan: async (planId: string, options: {
    name: string;
    interval: 'month' | 'year' | 'trial';
  }): Promise<SubscriptionPlan> => {
    try {
      const response: AxiosResponse<{ plan: any }> = await axios.post(
        `${API_URL}/api/super-admin/subscription-plans/${planId}/duplicate`,
        options,
        { headers: getAuthHeaders() }
      );
      
      const plan = response.data.plan;
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        transcriptionsPerMonth: plan.transcriptionsPerMonth,
        diskSpaceGB: plan.diskSpaceGB,
        features: plan.features,
        stripePriceId: plan.stripePriceId,
        popular: plan.popular || false,
        active: plan.active,
        trial_days: plan.trial_days,
        admin_only: plan.admin_only,
        createdAt: new Date(plan.created_at),
        updatedAt: new Date(plan.updated_at)
      };
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default {
  subscriptionPlansApi,
  userSubscriptionApi,
  adminSubscriptionApi
}; 