<<<<<<< HEAD
import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';
=======
import { apiFetch, getAuthHeaders } from './apiFetch';
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

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
<<<<<<< HEAD
  return unwrapApiData(res);
=======
  return res.data?.data || [];
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
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
<<<<<<< HEAD
  return unwrapApiData(res);
=======
  return res.data?.data;
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
};

export const sendReminder = async (followUpId: string): Promise<{ success: boolean; message: string }> => {
  const res = await apiFetch({
    path: `/followups/${followUpId}/send`,
    method: 'POST',
    headers: getAuthHeaders()
  });
<<<<<<< HEAD
  return res.data; // This endpoint doesn't use the standard data wrapper
=======
  return res.data;
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
};