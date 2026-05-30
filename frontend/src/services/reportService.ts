import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

export interface Report {
  _id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  content: string;
  format: 'PDF' | 'JSON';
  status: 'generated' | 'failed';
  filePath?: string;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportListResponse {
  reports: Report[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// List all reports with pagination
export const listReports = async (params?: {
  page?: number;
  limit?: number;
}): Promise<ReportListResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const res = await apiFetch({
    path: `/reports${query}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res);
};

// Get a specific report
export const getReport = async (reportId: string): Promise<Report> => {
  const res = await apiFetch({
    path: `/reports/${reportId}`,
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res).report;
};

// Download a report file
export const downloadReport = async (reportId: string): Promise<Blob> => {
  const res = await apiFetch({
    path: `/reports/${reportId}/download`,
    method: 'GET',
    headers: getAuthHeaders(),
    responseType: 'blob'
  });
  return res.data; // Blob response doesn't use data wrapper
};

export const saveReportPreview = async (consultationId: string, previewId: string, structuredContent: any, generatedBy?: string) => {
  const res = await apiFetch({
    path: `/consultations/${consultationId}/report/preview/${previewId}/save`,
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
    data: {
      structured_content: structuredContent,
      generatedBy: generatedBy || localStorage.getItem('user_name') || 'System'
    }
  });
  return unwrapApiData<{ report: any }>(res.data);
};

// Delete a report
export const deleteReport = async (reportId: string): Promise<void> => {
  await apiFetch({
    path: `/reports/${reportId}`,
    method: 'DELETE',
    headers: getAuthHeaders()
  });
};