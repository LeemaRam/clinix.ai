import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

export const checkDrugSafety = async (new_drugs: string[], existing_drugs: string[]) => {
  const res = await apiFetch({
    path: '/agents/drug-check',
    method: 'POST',
    headers: getAuthHeaders(),
    data: { new_drugs, existing_drugs }
  });
  return unwrapApiData(res);
};

export const getPatientBrief = async (patientId: string) => {
  const res = await apiFetch({
    path: `/agents/patient-brief/${patientId}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
<<<<<<< HEAD
  return unwrapApiData(res);
=======
  return res.data;
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
};

export const generateSOAPNote = async (patientId: string, transcription: string, consultationReason?: string) => {
  const res = await apiFetch({
    path: '/agents/soap-note',
    method: 'POST',
    headers: getAuthHeaders(),
    data: {
      patientId,
      transcription,
      consultationReason
    }
  });
<<<<<<< HEAD
  return unwrapApiData(res);
=======
  return res.data;
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
};

export const approveSoapNote = async (consultationId: string, approved: boolean) => {
  const res = await apiFetch({
    path: `/consultations/${consultationId}/approve-soap`,
    method: 'POST',
    headers: getAuthHeaders(),
    data: { approved }
  });
<<<<<<< HEAD
  return res.data; // This endpoint doesn't use the standard data wrapper
=======
  return res.data;
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
};