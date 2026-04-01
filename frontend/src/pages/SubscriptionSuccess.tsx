import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { userSubscriptionApi } from '../services/subscriptionService';
import { useTranslation } from 'react-i18next';

const SubscriptionSuccess: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      // Verify the subscription and get details
      verifySubscription(sessionId);
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  const verifySubscription = async (sessionId: string) => {
    try {
      const data = await userSubscriptionApi.verifySubscription(sessionId);
      setSubscriptionDetails(data);
      toast.success(t('subscription.welcomeToNewSubscription'));
    } catch (error) {
      console.error('Error verifying subscription:', error);
      toast.error(t('subscription.errorVerifyingSubscription'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('subscription.verifyingSubscription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Success Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>

          {/* Success Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t('subscription.subscriptionActivated')}
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            {t('subscription.thankYouForSubscribing')}
          </p>

          {/* Subscription Details */}
          {subscriptionDetails && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('subscription.subscriptionDetails')}</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('subscription.plan')}:</span>
                  <span className="font-medium text-gray-900">{subscriptionDetails.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('subscription.price')}:</span>
                  <span className="font-medium text-gray-900">
                    ${subscriptionDetails.price}/{subscriptionDetails.interval}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('subscription.nextBilling')}:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(subscriptionDetails.nextBilling).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('subscription.transcriptions')}:</span>
                  <span className="font-medium text-gray-900">
                    {subscriptionDetails.transcriptionsPerMonth}/{t('subscription.month')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('subscription.storage')}:</span>
                  <span className="font-medium text-gray-900">
                    {subscriptionDetails.diskSpaceGB}GB
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            <Link
              to="/"
              className="w-full flex justify-center items-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              {t('subscription.goToDashboard')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            
            <Link
              to="/subscription"
              className="w-full flex justify-center items-center px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              {t('subscription.manageSubscription')}
            </Link>
          </div>

          {/* What's Next */}
          <div className="mt-12 text-left">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('subscription.whatsNext')}</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                {t('subscription.startCreatingTranscriptions')}
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                {t('subscription.uploadAndOrganizeDocuments')}
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                {t('subscription.exploreReportsAndAnalytics')}
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                {t('subscription.accessPrioritySupport')}
              </li>
            </ul>
          </div>

          {/* Contact Support */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {t('subscription.needHelpGettingStarted')}{' '}
              <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-500">
                {t('subscription.contactSupportTeam')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccess; 