import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listFollowUps, sendReminder as sendReminderAPI, FollowUp as FollowUpType } from '../services/followupService';
import { toast } from 'react-toastify';
import EmptyState from '../components/EmptyState';

const API_URL = String(import.meta.env.VITE_API_URL || '').trim();
const shouldUseProxy = (() => {
  if (!API_URL) return true;
  try {
    const { hostname } = new URL(API_URL);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return true;
  }
})();
const API_ROOT = shouldUseProxy ? '/api' : `${API_URL}/api`;

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('access_token')}`
});

interface FollowUp extends FollowUpType {}

const FollowUps = () => {
  const { t } = useTranslation();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchFollowUps();
  }, []);

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      const data = await listFollowUps();
      setFollowUps(data);
    } catch (err) {
      setError('Failed to load follow-ups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (followUpId: string) => {
    try {
      setSendingReminder(followUpId);
      await sendReminderAPI(followUpId);
      // Refresh the list
      await fetchFollowUps();
    } catch (err) {
      console.error('Failed to send reminder', err);
    } finally {
      setSendingReminder(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'completed': return 'text-green-600 bg-green-100';
      case 'missed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'sent': return <CheckCircle size={16} />;
      case 'completed': return <CheckCircle size={16} />;
      case 'missed': return <AlertCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return t('followUps.statusPending');
      case 'sent': return t('followUps.statusSent');
      case 'completed': return t('followUps.statusCompleted');
      case 'missed': return t('followUps.statusMissed');
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  const followUpList = Array.isArray(followUps)
    ? followUps
    : Array.isArray((followUps as any)?.data)
      ? (followUps as any).data
      : [];

  const statusOptions = Array.from(
    new Set(followUpList.map((f: FollowUp) => f.status).filter(Boolean))
  ) as string[];

  const visibleFollowUps = statusFilter === 'all'
    ? followUpList
    : followUpList.filter((f: FollowUp) => f.status === statusFilter);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Follow-up Management</h1>
        {followUpList.length > 0 && statusOptions.length > 1 && (
          <select
            aria-label={t('common.filterByStatus')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">{t('common.all')}</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{getStatusLabel(status)}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-4">
        {visibleFollowUps.map((followUp) => (
          <div key={followUp._id} className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-2">
                  <div className="flex items-center space-x-2">
                    <User size={18} className="text-gray-500" />
                    <span className="font-medium">
                      {followUp.patientId?.firstName || 'Unknown'} {followUp.patientId?.lastName || 'Patient'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone size={18} className="text-gray-500" />
                    <span>{followUp.patientPhone}</span>
                  </div>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${getStatusColor(followUp.status)}`}>
                    {getStatusIcon(followUp.status)}
                    <span>{getStatusLabel(followUp.status)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mb-2">
                  <Calendar size={18} className="text-gray-500" />
                  <span>Follow-up Date: {new Date(followUp.followUpDate).toLocaleDateString()}</span>
                </div>

                <div className="text-sm text-gray-600 mb-2">
                  <strong>Reason:</strong> {followUp.followUpReason}
                </div>

                {followUp.reminderSent && followUp.reminderSentAt && (
                  <div className="text-sm text-gray-500">
                    Reminder sent: {new Date(followUp.reminderSentAt).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="ml-4">
                {!followUp.reminderSent && followUp.status === 'pending' && (
                  <button
                    onClick={() => sendReminder(followUp._id)}
                    disabled={sendingReminder === followUp._id}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    {sendingReminder === followUp._id ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                      <Send size={16} className="mr-2" />
                    )}
                    Send Reminder
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {followUpList.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <EmptyState
              icon={<Clock size={24} />}
              title={t('followUps.noFollowUpsTitle')}
              description={t('followUps.noFollowUpsDescription')}
            />
          </div>
        )}

        {followUpList.length > 0 && visibleFollowUps.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <EmptyState
              icon={<Clock size={24} />}
              title={t('followUps.noFollowUpsTitle')}
              description={t('common.noResultsForFilter')}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowUps;