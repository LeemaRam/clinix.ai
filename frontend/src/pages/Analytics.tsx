import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, FileText, Activity, TrendingUp, Loader2, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';
import { API_ROOT } from '../services/apiFetch';

const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('access_token')}`
});

interface AnalyticsData {
  total_patients: number;
  total_consultations: number;
  total_reports: number;
  pending_followups: number;
  pending_appointments: number;
}

interface TrendData {
  _id: string;
  count: number;
}

interface DiagnosisData {
  _id: string;
  count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Analytics = () => {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewRes, trendsRes, diagnosesRes] = await Promise.all([
        axios.get(`${API_ROOT}/dashboard/analytics`, { headers: getAuthHeaders() }),
        axios.get(`${API_ROOT}/dashboard/trends`, { headers: getAuthHeaders() }),
        axios.get(`${API_ROOT}/dashboard/diagnoses`, { headers: getAuthHeaders() })
      ]);

      setAnalytics(overviewRes.data.data);
      setTrends(trendsRes.data.data);
      setDiagnoses(diagnosesRes.data.data);
    } catch (err) {
      setError('Failed to load analytics');
      console.error(err);
    } finally {
      setLoading(false);
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

  const hasTrends = trends.length > 0;
  const hasDiagnoses = diagnoses.length > 0;
  const hasAnyData =
    hasTrends ||
    hasDiagnoses ||
    Boolean(
      analytics &&
        (analytics.total_patients ||
          analytics.total_consultations ||
          analytics.total_reports ||
          analytics.pending_followups)
    );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">{t('analytics.analyticsDashboard')}</h1>

      {!hasAnyData ? (
        <div className="bg-white rounded-lg shadow-sm border">
          <EmptyState
            icon={<BarChart3 size={24} />}
            title={t('analytics.noDataTitle')}
            description={t('analytics.noDataDescription')}
          />
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('analytics.totalPatients')}</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics?.total_patients || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('analytics.totalConsultations')}</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics?.total_consultations || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('analytics.totalReports')}</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics?.total_reports || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{t('analytics.pendingFollowUps')}</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics?.pending_followups || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consultation Trends */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">{t('analytics.consultationTrends')}</h2>
              {hasTrends ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={<TrendingUp size={24} />}
                  title={t('analytics.noDataTitle')}
                  description={t('analytics.noTrendsDescription')}
                />
              )}
            </div>

            {/* Top Diagnoses */}
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">{t('analytics.topDiagnoses')}</h2>
              {hasDiagnoses ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={diagnoses.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={<BarChart3 size={24} />}
                  title={t('analytics.noDataTitle')}
                  description={t('analytics.noDiagnosesDescription')}
                />
              )}
            </div>
          </div>

          {/* Diagnosis Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">{t('analytics.diagnosisDistribution')}</h2>
            {hasDiagnoses ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={diagnoses.slice(0, 5)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ _id, percent }) => `${_id}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {diagnoses.slice(0, 5).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={<BarChart3 size={24} />}
                title={t('analytics.noDataTitle')}
                description={t('analytics.noDiagnosesDescription')}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;