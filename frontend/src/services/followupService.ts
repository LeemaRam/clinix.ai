import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

export interface FollowUp {
  _id: string;
  consultationId: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  doctorId: string;
  followUpDate: string;
  followUpReason: string;
  patientPhone: string;
  reminderSent?: boolean;
  reminderSentAt?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const listFollowUps = async (): Promise<FollowUp[]> => {
  const res = await apiFetch({
    path: '/followups',
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res);
};

export const scheduleFollowUp = async (data: {
  consultationId: string;
  followUpDate?: string;
  followUpReason?: string;
  patientPhone?: string;
}): Promise<FollowUp> => {
  const res = await apiFetch({
    path: '/followups',
    method: 'POST',
    headers: getAuthHeaders(),
    data
  });
  return unwrapApiData(res);
};

export const sendReminder = async (followUpId: string): Promise<{ success: boolean; message: string }> => {
  const res = await apiFetch({
    path: `/followups/${followUpId}/send`,
    method: 'POST',
    headers: getAuthHeaders()
  });
  return res.data; // This endpoint doesn't use the standard data wrapper
};