import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

export interface PatientFile {
  _id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  blood_type?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_conditions?: string[];
  allergies?: string[];
  current_medications?: string[];
  vital_signs?: any[];
  notes?: any[];
  doctor_id?: string;
  status?: string;
  last_visit?: string;
  consultation_count?: number;
  uploadedFiles?: PatientFile[];
  created_at?: string;
  updated_at?: string;
}

export interface CreatePatientRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  blood_type?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  medical_conditions?: string[];
  allergies?: string[];
  current_medications?: string[];
}

export interface UpdatePatientRequest extends Partial<CreatePatientRequest> {}

export interface PatientListResponse {
  patients: Patient[];
  total: number;
  page: number;
  pages: number;
}

// File management functions
export const uploadPatientFile = async (patientId: string, formData: FormData) => {
  const res = await apiFetch({
    path: `/patients/${patientId}/files`,
    method: 'POST',
    data: formData,
    headers: getAuthHeaders()
  });
  return unwrapApiData(res.data);
};

export const getPatientFiles = async (patientId: string) => {
  const res = await apiFetch({
    path: `/patients/${patientId}/files`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData<PatientFile[]>(res.data);
};

export const deletePatientFile = async (patientId: string, fileId: string) => {
  const res = await apiFetch({
    path: `/patients/${patientId}/files/${fileId}`,
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  return unwrapApiData<{ deleted: boolean }>(res.data);
};

export const downloadPatientFile = async (patientId: string, fileId: string) => {
  return apiFetch({
    path: `/patients/${patientId}/files/${fileId}/download`,
    method: 'GET',
    headers: getAuthHeaders(),
    responseType: 'blob'
  });
};

// Patient management functions
export const listPatients = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PatientListResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.search) queryParams.append('search', params.search);

  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const res = await apiFetch({
    path: `/patients${query}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData<PatientListResponse>(res.data);
};

export const createPatient = async (data: CreatePatientRequest): Promise<Patient> => {
  const res = await apiFetch({
    path: '/patients',
    method: 'POST',
    headers: getAuthHeaders(),
    data
  });
  const payload = unwrapApiData<{ patient: Patient }>(res.data);
  return payload.patient;
};

export const getPatient = async (patientId: string): Promise<Patient> => {
  const res = await apiFetch({
    path: `/patients/${patientId}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  const payload = unwrapApiData<{ patient: Patient }>(res.data);
  return payload.patient;
};

export const updatePatient = async (
  patientId: string,
  data: UpdatePatientRequest
): Promise<Patient> => {
  const res = await apiFetch({
    path: `/patients/${patientId}`,
    method: 'PUT',
    headers: getAuthHeaders(),
    data
  });
  const payload = unwrapApiData<{ patient: Patient }>(res.data);
  return payload.patient;
};