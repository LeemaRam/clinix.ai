import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
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
    <div className="space-y-8 py-2 sm:py-4">
      <div className="page-card border border-white/70 px-6 py-8 text-center sm:px-10 sm:py-9">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 sm:text-sm">
          <Sparkles size={16} />
          {t('superAdmin.chooseYourPlan')}
        </div>
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-slate-900 sm:text-5xl">
          {t('superAdmin.chooseYourPlan')}
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
          {t('superAdmin.selectPerfectPlan')}
        </p>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 shadow-inner">
            <button
              onClick={() => setSelectedInterval('month')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                selectedInterval === 'month'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t('superAdmin.monthly')}
            </button>
            <button
              onClick={() => setSelectedInterval('year')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                selectedInterval === 'year'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t('superAdmin.yearly')}
              <span className="ml-1 text-xs font-semibold text-success-600">{t('superAdmin.save17Percent')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {filteredPlans.map((plan) => (
          <div
            key={plan.id}
            className={`relative overflow-visible rounded-[2rem] border bg-white shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-soft ${
              plan.popular
                ? 'border-primary-500 ring-2 ring-primary-500/20'
                : 'border-slate-200'
            }`}
          >
            {plan.popular && (
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
              <span className="rounded-full bg-primary-600 px-4 py-1 text-sm font-semibold text-white shadow-soft">
                  {t('superAdmin.mostPopular')}
                </span>
              </div>
            )}

            <div className="flex h-full flex-col justify-between p-8 pt-10">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-2 text-slate-600">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-slate-900">
                    ${plan.price}
                  </span>
                  <span className="ml-1 text-slate-600">
                    /{plan.interval === 'month' ? t('superAdmin.month') : t('superAdmin.year')}
                  </span>
                </div>
                {plan.interval === 'year' && (
                  <p className="mt-1 text-sm text-success-600">
                    ${Math.round((plan.price / 12) * 100) / 100} {t('superAdmin.monthBilledAnnually')}
                  </p>
                )}
              </div>

              <div className="mt-8 space-y-4">
                <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{t('superAdmin.transcriptions')}</span>
                    <span className="text-slate-600">
                      {plan.transcriptionsPerMonth.toLocaleString()}/{t('superAdmin.month')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{t('superAdmin.storage')}</span>
                    <span className="text-slate-600">{plan.diskSpaceGB} GB</span>
                  </div>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <FaCheckCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-success-500" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={processingPlanId === plan.id}
                className={`btn-primary mt-8 w-full py-3 ${
                  plan.popular
                    ? ''
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {processingPlanId === plan.id ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white"></div>
                    {t('superAdmin.processing')}
                  </div>
                ) : (
                  t('superAdmin.getStarted')
                )}
              </button>
            </div>
          </div>
        ))}

        <div className="relative overflow-visible rounded-[2rem] border border-slate-200 bg-white shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-soft">
          <div className="flex h-full flex-col justify-between p-8 pt-10">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900">Enterprise</h3>
              <p className="mt-2 text-slate-600">For larger teams that need custom workflows and support.</p>
              <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-slate-900">Custom</span>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="space-y-4 rounded-2xl bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Transcriptions</span>
                  <span className="text-slate-600">Unlimited</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Storage</span>
                  <span className="text-slate-600">Custom</span>
                </div>
              </div>

              <ul className="space-y-3">
                <li className="flex items-start">
                  <FaCheckCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-success-500" />
                  <span className="text-slate-600">Dedicated onboarding</span>
                </li>
                <li className="flex items-start">
                  <FaCheckCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-success-500" />
                  <span className="text-slate-600">Priority support</span>
                </li>
                <li className="flex items-start">
                  <FaCheckCircle className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-success-500" />
                  <span className="text-slate-600">Custom integrations</span>
                </li>
              </ul>
            </div>

            <button className="btn-primary mt-8 w-full bg-emerald-700 py-3 hover:bg-emerald-800">
              Contact sales
            </button>
          </div>
        </div>
      </div>

      <div className="page-card px-6 py-10 sm:px-10">
        <h2 className="text-center text-2xl font-bold text-slate-900">
          {t('superAdmin.frequentlyAskedQuestions')}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold text-slate-900">
              {t('superAdmin.canChangePlanAnytime')}
            </h3>
            <p className="mt-2 text-slate-600">
              {t('superAdmin.canChangePlanAnytimeAnswer')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              {t('superAdmin.whatHappensIfExceedLimits')}
            </h3>
            <p className="mt-2 text-slate-600">
              {t('superAdmin.whatHappensIfExceedLimitsAnswer')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              {t('superAdmin.isThereFreeTrial')}
            </h3>
            <p className="mt-2 text-slate-600">
              {t('superAdmin.isThereFreeTrialAnswer')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              {t('superAdmin.howSecureIsData')}
            </h3>
            <p className="mt-2 text-slate-600">
              {t('superAdmin.howSecureIsDataAnswer')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing; 