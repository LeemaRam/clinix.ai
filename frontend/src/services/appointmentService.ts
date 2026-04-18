import { apiFetch, getAuthHeaders } from './apiFetch';

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

  return apiFetch({
    path: '/appointments',
    method: 'POST',
    data: backendData
  });
};

export const getAppointments = async () => {
  return apiFetch({
    path: '/appointments',
    method: 'GET',
    headers: getAuthHeaders()
  });
};

export const updateAppointment = async (id: string, status: 'confirmed' | 'cancelled') => {
  return apiFetch({
    path: `/appointments/${id}`,
    method: 'PATCH',
    headers: getAuthHeaders(),
    data: { status }
  });
};