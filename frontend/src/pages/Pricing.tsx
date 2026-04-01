import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheckCircle } from 'react-icons/fa';
import { SubscriptionPlan, CheckoutSessionRequest } from '../types/subscription';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { subscriptionPlansApi, userSubscriptionApi } from '../services/subscriptionService';

const Pricing: React.FC = () => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const plans = await subscriptionPlansApi.getAvailablePlans();
      setPlans(plans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      toast.error(t('superAdmin.errorFetchingPlans'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) {
      toast.error(t('auth.pleaseLoginToSubscribe'));
      return;
    }

    setProcessingPlanId(plan.id);

    try {
      const request: CheckoutSessionRequest = {
        planId: plan.id,
        successUrl: `${window.location.origin}/subscription/success`,
        cancelUrl: `${window.location.origin}/pricing`
      };

      const checkoutSession = await userSubscriptionApi.createCheckoutSession(request);
      
      // Redirect to Stripe checkout
      window.location.href = checkoutSession.url;
      
    } catch (error) {
      console.error('Failed to create checkout session:', error);
      toast.error(t('superAdmin.failedToStartCheckout'));
    } finally {
      setProcessingPlanId(null);
    }
  };

  const filteredPlans = plans.filter(plan => plan.interval === selectedInterval);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {t('superAdmin.chooseYourPlan')}
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
          {t('superAdmin.selectPerfectPlan')}
        </p>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setSelectedInterval('month')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedInterval === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t('superAdmin.monthly')}
            </button>
            <button
              onClick={() => setSelectedInterval('year')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedInterval === 'year'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {t('superAdmin.yearly')}
                              <span className="ml-1 text-xs text-green-600 font-semibold">{t('superAdmin.save17Percent')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 ">
        {filteredPlans.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl ${
              plan.popular
                ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20'
                : 'border-gray-200'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  {t('superAdmin.mostPopular')}
                </span>
              </div>
            )}

            <div className="p-8 flex flex-col justify-between h-full">
              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600 ml-1">
                    /{plan.interval === 'month' ? t('superAdmin.month') : t('superAdmin.year')}
                  </span>
                </div>
                {plan.interval === 'year' && (
                  <p className="text-sm text-green-600 mt-1">
                    ${Math.round((plan.price / 12) * 100) / 100}{t('superAdmin.monthBilledAnnually')}
                  </p>
                )}
              </div>

              {/* Plan Features */}
              <div className="mb-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-medium">{t('superAdmin.transcriptions')}</span>
                    <span className="text-gray-600">
                      {plan.transcriptionsPerMonth.toLocaleString()}/{t('superAdmin.month')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-medium">{t('superAdmin.storage')}</span>
                    <span className="text-gray-600">{plan.diskSpaceGB}{t('superAdmin.gb')}</span>
                  </div>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <FaCheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Subscribe Button */}
              <button
                onClick={() => handleSubscribe(plan)}
                disabled={processingPlanId === plan.id}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                    : 'bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-400'
                } disabled:cursor-not-allowed`}
              >
                {processingPlanId === plan.id ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {t('superAdmin.processing')}
                  </div>
                ) : (
                  t('superAdmin.getStarted')
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="mt-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">
          {t('superAdmin.frequentlyAskedQuestions')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('superAdmin.canChangePlanAnytime')}
            </h3>
            <p className="text-gray-600">
              {t('superAdmin.canChangePlanAnytimeAnswer')}
            </p>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('superAdmin.whatHappensIfExceedLimits')}
            </h3>
            <p className="text-gray-600">
              {t('superAdmin.whatHappensIfExceedLimitsAnswer')}
            </p>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('superAdmin.isThereFreeTrial')}
            </h3>
            <p className="text-gray-600">
              {t('superAdmin.isThereFreeTrialAnswer')}
            </p>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 mb-2">
              {t('superAdmin.howSecureIsData')}
            </h3>
            <p className="text-gray-600">
              {t('superAdmin.howSecureIsDataAnswer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing; 