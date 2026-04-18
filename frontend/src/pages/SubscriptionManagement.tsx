import React, { useState, useEffect } from 'react';
import { 
  FaCreditCard, 
  FaCalendarAlt, 
  FaChartBar,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSync
} from 'react-icons/fa';
import { UserSubscription, SubscriptionUsage, SubscriptionPlan } from '../types/subscription';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { userSubscriptionApi } from '../services/subscriptionService';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ui/ConfirmDialog';

const SubscriptionManagement: React.FC = () => {
  const { t } = useTranslation();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [usage, setUsage] = useState<SubscriptionUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      const data = await userSubscriptionApi.getCurrentSubscription();
      
      setSubscription(data.subscription);
      setPlan(data.plan);
      setUsage(data.usage);
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
      toast.error(t('subscription.failedToLoadSubscriptionInfo'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    setUpdating(true);
    try {
      await userSubscriptionApi.cancelSubscription();
      
      // Update local state
      setSubscription({
        ...subscription,
        cancelAtPeriodEnd: true
      });
      
      toast.success(t('subscription.subscriptionCanceledAccessUntilEnd'));
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      toast.error(t('subscription.failedToCancelSubscription'));
    } finally {
      setUpdating(false);
    }
  };

  const handleReactivateSubscription = async () => {
    if (!subscription) return;

    setUpdating(true);
    try {
      await userSubscriptionApi.reactivateSubscription();
      
      // Update local state
      setSubscription({
        ...subscription,
        cancelAtPeriodEnd: false
      });
      
      toast.success(t('subscription.subscriptionReactivated'));
    } catch (error) {
      console.error('Failed to reactivate subscription:', error);
      toast.error(t('subscription.failedToReactivateSubscription'));
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePaymentMethod = () => {
    // Redirect to Stripe customer portal or payment method update
    const portalUrl = `https://billing.stripe.com/p/login/test_portal_${subscription?.stripeCustomerId}`;
    window.open(portalUrl, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'canceled':
        return 'text-red-600 bg-red-100';
      case 'past_due':
        return 'text-yellow-600 bg-yellow-100';
      case 'trialing':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600"></div>
      </div>
    );
  }

  if (!subscription || !plan || !usage) {
    return (
      <div className="page-card py-12 text-center">
        <h2 className="mb-4 text-2xl font-bold text-slate-900">{t('subscription.noActiveSubscription')}</h2>
        <p className="mb-8 text-slate-600">{t('subscription.noActiveSubscriptionDescription')}</p>
        <Link
          to="/pricing"
          className="btn-primary"
        >
          {t('subscription.viewPricingPlans')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ConfirmDialog
        open={showCancelDialog}
        title={t('subscription.confirmCancelSubscription')}
        description={t('subscription.subscriptionWillEndOn')}
        confirmLabel={t('subscription.cancelSubscription')}
        cancelLabel={t('common.cancel')}
        loading={updating}
        onConfirm={handleCancelSubscription}
        onCancel={() => setShowCancelDialog(false)}
      />

      {/* Header */}
      <div className="page-card p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{t('subscription.subscriptionManagement')}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(subscription.status)}`}>
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
          </span>
        </div>
        
        {subscription.cancelAtPeriodEnd && (
          <div className="mb-4 rounded-2xl border border-warning-200 bg-warning-50 p-4">
            <div className="flex items-center">
              <FaExclamationTriangle className="mr-3 h-5 w-5 text-warning-500" />
              <div>
                <p className="font-medium text-warning-800">{t('subscription.subscriptionCanceled')}</p>
                <p className="text-sm text-warning-700">
                  {t('subscription.subscriptionWillEndOn')} {subscription.currentPeriodEnd.toLocaleDateString()}.
                  {t('subscription.canReactivateAnytime')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Plan */}
      <div className="page-card p-6 sm:p-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{t('subscription.currentPlan')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="mb-2 text-xl font-bold text-slate-900">{plan.name}</h3>
            <p className="mb-4 text-slate-600">{plan.description}</p>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold text-slate-900">${plan.price}</span>
              <span className="ml-1 text-slate-600">/{plan.interval}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-slate-600">
              <FaCalendarAlt className="h-4 w-4 mr-2" />
              {t('subscription.nextBilling')}: {subscription.currentPeriodEnd.toLocaleDateString()}
            </div>
            <div className="flex items-center text-sm text-slate-600">
              <FaCreditCard className="h-4 w-4 mr-2" />
              {t('subscription.paymentMethod')}: •••• 4242
            </div>
          </div>
        </div>
        
        <div className="mt-6 border-t border-slate-200 pt-6">
          <div className="flex flex-wrap gap-3">
            <Link
              to="/pricing"
              className="btn-primary"
            >
              {t('subscription.changePlan')}
            </Link>
            <button
              onClick={handleUpdatePaymentMethod}
              className="btn-secondary"
            >
              {t('subscription.updatePaymentMethod')}
            </button>
            {subscription.cancelAtPeriodEnd ? (
              <button
                onClick={handleReactivateSubscription}
                disabled={updating}
                className="btn-primary bg-success-600 hover:bg-success-700"
              >
                {updating ? (
                  <div className="flex items-center">
                    <FaSync className="h-4 w-4 mr-1 animate-spin" />
                    {t('subscription.reactivating')}...
                  </div>
                ) : (
                  t('subscription.reactivateSubscription')
                )}
              </button>
            ) : (
              <button
                onClick={() => setShowCancelDialog(true)}
                disabled={updating}
                className="btn-danger"
              >
                {updating ? (
                  <div className="flex items-center">
                    <FaSync className="h-4 w-4 mr-1 animate-spin" />
                    {t('subscription.canceling')}...
                  </div>
                ) : (
                  t('subscription.cancelSubscription')
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="page-card p-6 sm:p-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{t('subscription.usageThisMonth')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transcriptions Usage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{t('subscription.transcriptions')}</span>
              <span className="text-sm text-slate-600">
                {usage.transcriptionsUsed} / {usage.transcriptionsLimit}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(
                  getUsagePercentage(usage.transcriptionsUsed, usage.transcriptionsLimit)
                )}`}
                style={{
                  width: `${Math.min(
                    getUsagePercentage(usage.transcriptionsUsed, usage.transcriptionsLimit),
                    100
                  )}%`
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">
              {getUsagePercentage(usage.transcriptionsUsed, usage.transcriptionsLimit)}% {t('subscription.used')}
            </p>
          </div>

          {/* Storage Usage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">{t('subscription.storage')}</span>
              <span className="text-sm text-slate-600">
                {usage.diskSpaceUsedGB}GB / {usage.diskSpaceLimitGB}GB
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(
                  getUsagePercentage(usage.diskSpaceUsedGB, usage.diskSpaceLimitGB)
                )}`}
                style={{
                  width: `${Math.min(
                    getUsagePercentage(usage.diskSpaceUsedGB, usage.diskSpaceLimitGB),
                    100
                  )}%`
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500">
              {getUsagePercentage(usage.diskSpaceUsedGB, usage.diskSpaceLimitGB)}% {t('subscription.used')}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            {t('subscription.usageResetsOn')} {usage.resetDate.toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('subscription.recentInvoices')}</h2>
        <div className="space-y-3">
          {/* Mock invoice data */}
          {[
            {
              id: 'inv_1',
              date: new Date('2024-01-01'),
              amount: 79,
              status: 'paid',
              downloadUrl: '#'
            },
            {
              id: 'inv_2',
              date: new Date('2023-12-01'),
              amount: 79,
              status: 'paid',
              downloadUrl: '#'
            }
          ].map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg"
            >

      <ConfirmDialog
        open={showCancelDialog}
        title={t('subscription.confirmCancelSubscription')}
        description={`${t('subscription.subscriptionWillEndOn')} ${subscription.currentPeriodEnd.toLocaleDateString()}. ${t('subscription.canReactivateAnytime')}`}
        confirmLabel={t('subscription.cancelSubscription')}
        cancelLabel={t('common.cancel')}
        loading={updating}
        onConfirm={handleCancelSubscription}
        onCancel={() => setShowCancelDialog(false)}
      />
              <div className="flex items-center space-x-4">
                              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                <FaCheckCircle className="h-4 w-4 text-green-600" />
              </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    ${invoice.amount} - {invoice.date.toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {plan.name} {t('subscription.plan')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.open(invoice.downloadUrl, '_blank')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {t('subscription.download')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement; 