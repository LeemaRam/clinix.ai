import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

export const getAnalyticsOverview = async () => {
  const res = await apiFetch({ path: '/dashboard/analytics', method: 'GET', headers: getAuthHeaders() });
  return unwrapApiData(res);
};

export const getConsultationTrend = async () => {
  const res = await apiFetch({ path: '/dashboard/trends', method: 'GET', headers: getAuthHeaders() });
  return unwrapApiData(res);
};

export const getTopDiagnoses = async () => {
  const res = await apiFetch({ path: '/dashboard/diagnoses', method: 'GET', headers: getAuthHeaders() });
  return unwrapApiData(res);
};