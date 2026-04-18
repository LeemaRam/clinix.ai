import { apiFetch, getAuthHeaders } from './apiFetch';

export const getAnalyticsOverview = async () => {
  const res = await apiFetch({ path: '/dashboard/analytics', method: 'GET', headers: getAuthHeaders() });
  return res.data;
};

export const getConsultationTrend = async () => {
  const res = await apiFetch({ path: '/dashboard/trends', method: 'GET', headers: getAuthHeaders() });
  return res.data;
};

export const getTopDiagnoses = async () => {
  const res = await apiFetch({ path: '/dashboard/diagnoses', method: 'GET', headers: getAuthHeaders() });
  return res.data;
};