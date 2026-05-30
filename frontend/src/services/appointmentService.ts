import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

// Public — no auth needed
export const bookAppointment = async (data: {
  patientName: string;
  patientPhone: string;
  preferredDate: string;
  reason?: string;
}) => {
  // Convert camelCase to snake_case for backend
  const backendData = {
    patient_name: data.patientName,
    patient_phone: data.patientPhone,
    preferred_date: data.preferredDate,
    reason: data.reason
  };

  const res = await apiFetch({
    path: '/appointments',
    method: 'POST',
    data: backendData
  });
  return unwrapApiData(res);
};

export const getAppointments = async () => {
  const res = await apiFetch({
    path: '/appointments',
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res);
};

export const updateAppointment = async (id: string, status: 'confirmed' | 'cancelled') => {
  const res = await apiFetch({
    path: `/appointments/${id}`,
    method: 'PATCH',
    headers: getAuthHeaders(),
    data: { status }
  });
  return unwrapApiData(res);
};