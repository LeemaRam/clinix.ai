import React from 'react';
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SubscriptionCancel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Cancel Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>

          {/* Cancel Message */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t('subscription.subscriptionCanceled')}
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            {t('subscription.subscriptionProcessCanceled')}
          </p>

          {/* Action Buttons */}
          <div className="space-y-4">
            <Link
              to="/pricing"
              className="w-full flex justify-center items-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {t('subscription.tryAgain')}
            </Link>
            
            <Link
              to="/"
              className="w-full flex justify-center items-center px-6 py-3 border border-gray-300 rounded-lg text-base font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('subscription.backToDashboard')}
            </Link>
          </div>

          {/* Help Section */}
          <div className="mt-12 text-left bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('subscription.needHelp')}</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">{t('subscription.commonIssues')}:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• {t('subscription.paymentMethodDeclined')}</li>
                  <li>• {t('subscription.browserCompatibilityIssues')}</li>
                  <li>• {t('subscription.networkConnectionProblems')}</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-1">{t('subscription.whatYouCanDo')}:</h4>
                <ul className="space-y-1 ml-4">
                  <li>• {t('subscription.tryDifferentPaymentMethod')}</li>
                  <li>• {t('subscription.clearBrowserCache')}</li>
                  <li>• {t('subscription.contactBankIfCardDeclined')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Support */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {t('subscription.stillHavingTrouble')}{' '}
              <a href="mailto:support@example.com" className="text-blue-600 hover:text-blue-500">
                {t('subscription.contactSupportTeam')}
              </a>
              {' '}{t('subscription.orCallUsAt')}{' '}
              <a href="tel:+1234567890" className="text-blue-600 hover:text-blue-500">
                (123) 456-7890
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCancel; 