import React, { useState } from 'react';
import { SubscriptionPlan } from '../../types/subscription';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { userSubscriptionApi } from '../../services/subscriptionService';
import { useTranslation } from 'react-i18next';

interface StripeCheckoutProps {
  plan: SubscriptionPlan;
  onSuccess: () => void;
  onCancel: () => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ plan, onSuccess, onCancel }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!user) {
      toast.error(t('subscription.pleaseLoginToSubscribe'));
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const checkoutSession = await userSubscriptionApi.createCheckoutSession({
        planId: plan.id,
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/subscription/cancel`
      });

      // Redirect to Stripe checkout
      window.location.href = checkoutSession.url;
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      setError(error.message || t('subscription.failedToStartCheckout'));
      toast.error(t('subscription.failedToStartCheckout'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-sm border">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {t('subscription.subscribeTo')} {plan.name}
        </h3>
        <p className="text-gray-600 mb-4">{plan.description}</p>
        <div className="text-3xl font-bold text-gray-900">
          ${plan.price}
          <span className="text-sm font-normal text-gray-600">/{plan.interval}</span>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3">{t('subscription.featuresIncluded')}:</h4>
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-center text-sm text-gray-600">
              <svg
                className="h-4 w-4 text-green-500 mr-2 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleCheckout}
          disabled={processing}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {processing ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('subscription.processing')}...
            </span>
          ) : (
            `${t('subscription.subscribeTo')} ${plan.name}`
          )}
        </button>
        
        <button
          onClick={onCancel}
          disabled={processing}
          className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center mt-4">
        {t('subscription.securePaymentProcessing')} {t('subscription.canCancelAnytime')}
      </p>
    </div>
  );
};

export default StripeCheckout; 