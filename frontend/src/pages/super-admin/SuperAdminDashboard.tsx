import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { 
  Users, 
  Activity, 
  Server, 
  AlertCircle, 
  CheckCircle,
  Loader2 
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalConsultations: number;
  pendingTranscriptions: number;
  systemHealth: 'healthy' | 'warning' | 'error';
  serverStatus: 'online' | 'offline';
  storageUsage: number;
  storageLimit: number;
}

const SuperAdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/super-admin/stats`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      setStats(response.data);
    } catch (error) {
      setError('Failed to fetch system statistics');
      console.error('Error fetching system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle size={20} />;
      case 'warning': 
      case 'error': return <AlertCircle size={20} />;
      default: return <Activity size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">
          {t('superAdmin.dashboard')}
        </h1>
        <button
          onClick={fetchSystemStats}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {t('superAdmin.totalUsers')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalUsers || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {t('superAdmin.activeUsers')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.activeUsers || 0}
              </p>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${getHealthColor(stats?.systemHealth || 'healthy')}`}>
              {getHealthIcon(stats?.systemHealth || 'healthy')}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {t('superAdmin.systemHealth')}
              </p>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {stats?.systemHealth || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Server Status */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              stats?.serverStatus === 'online' 
                ? 'text-green-600 bg-green-100' 
                : 'text-red-600 bg-red-100'
            }`}>
              <Server className="w-6 h-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {t('superAdmin.serverStatus')}
              </p>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {stats?.serverStatus || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Statistics */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Usage Statistics
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Consultations</span>
              <span className="font-semibold">{stats?.totalConsultations || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pending Transcriptions</span>
              <span className="font-semibold">{stats?.pendingTranscriptions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Storage Usage</span>
              <span className="font-semibold">
                {stats?.storageUsage || 0}GB / {stats?.storageLimit || 0}GB
              </span>
            </div>
            {stats?.storageUsage && stats?.storageLimit && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-cyan-600 h-2 rounded-full" 
                  style={{ 
                    width: `${Math.min((stats.storageUsage / stats.storageLimit) * 100, 100)}%` 
                  }}
                ></div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="font-medium text-gray-800">
                {t('superAdmin.manageUsers')}
              </div>
              <div className="text-sm text-gray-600">
                Add, edit, or remove user accounts
              </div>
            </button>
            <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="font-medium text-gray-800">
                {t('superAdmin.manageSystem')}
              </div>
              <div className="text-sm text-gray-600">
                Configure system settings and preferences
              </div>
            </button>
            <button className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="font-medium text-gray-800">
                {t('superAdmin.manageLanguages')}
              </div>
              <div className="text-sm text-gray-600">
                Manage supported languages and translations
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard; 