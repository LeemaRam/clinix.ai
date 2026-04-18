import { apiFetch, getAuthHeaders } from './apiFetch';

export const checkDrugSafety = async (new_drugs: string[], existing_drugs: string[]) => {
  const res = await apiFetch({
    path: '/agents/drug-check',
    method: 'POST',
    headers: getAuthHeaders(),
    data: { new_drugs, existing_drugs }
  });
  return res.data;
};

export const getPatientBrief = async (patientId: string) => {
  const res = await apiFetch({
    path: `/agents/patient-brief/${patientId}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  return res.data;
};