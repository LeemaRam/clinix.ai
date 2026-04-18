import { apiFetch } from './apiFetch';

export interface PatientFile {
  _id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export const uploadPatientFile = async (patientId: string, formData: FormData) => {
  return apiFetch({
    path: `/patients/${patientId}/files`,
    method: 'POST',
    data: formData,
    headers: {
      // Don't set Content-Type for FormData, let browser set it with boundary
    },
  });
};

export const getPatientFiles = async (patientId: string) => {
  return apiFetch({ path: `/patients/${patientId}/files` });
};

export const deletePatientFile = async (patientId: string, fileId: string) => {
  return apiFetch({
    path: `/patients/${patientId}/files/${fileId}`,
    method: 'DELETE',
  });
};

export const downloadPatientFile = async (patientId: string, fileId: string) => {
  return apiFetch({
    path: `/patients/${patientId}/files/${fileId}/download`,
    responseType: 'blob',
  });
};