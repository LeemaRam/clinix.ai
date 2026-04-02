import { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  Download,
  Calendar,
  Loader2,
  Trash2,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { getSocket } from '../services/socket';
import RealtimeStatusBadge from '../components/common/RealtimeStatusBadge';

interface Report {
  id: string;
  consultation_id: string;
  doctor_id: string;
  patient_id: string;
  format: string;
  status: string;
  created_at: string;
  filename: string;
  pdf_path: string;
  download_url: string;
  patient?: {
    _id: string;
    first_name: string;
    last_name: string;
    email?: string;
    date_of_birth: string;
    gender: string;
  } | null;
}

interface PaginationData {
  total: number;
  page: number;
  pages: number;
}

interface ReportGenerationEvent {
  consultationId: string;
  reportId?: string;
  previewId?: string | null;
}

const Reports = () => {
  const apiRoot = '/api';
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    pages: 1
  });
  const limit = 10;

  useEffect(() => {
    fetchReports();
  }, [pagination.page, selectedFormat]);

  useEffect(() => {
    const socket = getSocket();

    const onReportGenerationStarted = (event: ReportGenerationEvent) => {
      setReports((prev) => prev.map((report) => (
        report.consultation_id === event.consultationId
          ? { ...report, status: 'processing' }
          : report
      )));
    };

    const onReportGenerationCompleted = (event: ReportGenerationEvent) => {
      setReports((prev) => prev.map((report) => (
        report.consultation_id === event.consultationId
          ? { ...report, status: 'completed' }
          : report
      )));
    };

    socket.on('report_generation_started', onReportGenerationStarted);
    socket.on('report_generation_completed', onReportGenerationCompleted);

    return () => {
      socket.off('report_generation_started', onReportGenerationStarted);
      socket.off('report_generation_completed', onReportGenerationCompleted);
    };
  }, []);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    'Content-Type': 'application/json'
  });

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', String(pagination.page));
      params.append('limit', String(limit));
      if (selectedFormat !== 'all') params.append('format', selectedFormat);

      const response = await axios.get(
        `${apiRoot}/reports?${params.toString()}`,
        { headers: getAuthHeaders() }
      );

      const payload = response.data?.data || response.data;
      setReports(payload.reports || []);
      setPagination({
        total: payload.total || 0,
        page: payload.page || 1,
        pages: payload.pages || 1
      });
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || t('errors.somethingWentWrong');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Search filter (client-side for now)
  const filteredReports = reports.filter(report => {
    const patientName = report.patient ? `${report.patient.first_name} ${report.patient.last_name}` : '';
    return patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           report.format.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDownloadReport = async (reportId: string) => {
    setDownloadLoading(reportId);
    try {
      const response = await axios.get(
        `${apiRoot}/reports/${reportId}/download`,
        { 
          headers: getAuthHeaders(),
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(t('reports.reportDownloadedSuccessfully'));
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || t('errors.somethingWentWrong');
      toast.error(message);
    } finally {
      setDownloadLoading(null);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm(t('reports.confirmDeleteReport'))) return;

    setDeleteLoading(reportId);
    try {
      await axios.delete(
        `${apiRoot}/reports/${reportId}`,
        { headers: getAuthHeaders() }
      );

      setReports(prev => prev.filter(report => report.id !== reportId));
      toast.success(t('reports.reportDeletedSuccessfully'));
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || t('errors.somethingWentWrong');
      toast.error(message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return t('reports.statusCompleted');
      case 'processing':
        return t('reports.statusProcessing');
      case 'failed':
        return t('reports.statusFailed');
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 sm:py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">
          {t('reports.reports')}
        </h1>
        
        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('reports.searchReports')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-3 pl-10 pr-4 text-sm text-gray-700 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <select
            value={selectedFormat}
            onChange={(e) => {
              setSelectedFormat(e.target.value);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            className="w-full sm:w-auto py-3 px-3 text-sm text-gray-700 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white"
          >
            <option value="all">{t('reports.allFormats')}</option>
            <option value="SOAP">{t('reports.soapFormat')}</option>
            <option value="Comprehensive">{t('reports.comprehensiveFormat')}</option>
            <option value="Brief">{t('reports.briefFormat')}</option>
          </select>
          <button
            onClick={() => fetchReports()}
            className="w-full sm:w-auto flex items-center justify-center px-4 py-3 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            <FileText size={16} className="mr-2" />
            {t('reports.refreshReports')}
          </button>
        </div>
      </div>

      {/* Reports Content */}
      <div className="px-4 py-4 sm:px-6 sm:py-6">
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <Loader2 className="animate-spin mx-auto mb-4" size={32} />
            {t('common.loading')}
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
            <AlertCircle className="mx-auto mb-4" size={32} />
            {error}
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <FileText className="mx-auto mb-4 text-gray-400" size={32} />
            {t('reports.noReportsFound')}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('reports.patient')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('reports.format')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('reports.status')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('reports.createdAt')}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {report.patient ? `${report.patient.first_name} ${report.patient.last_name}` : t('reports.unknownPatient')}
                          </div>
                          {report.patient && (
                            <div className="text-sm text-gray-500">
                              {report.patient.email}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            report.format === 'SOAP' ? 'bg-blue-100 text-blue-800' :
                            report.format === 'Comprehensive' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {report.format}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <RealtimeStatusBadge
                            label={getStatusLabel(report.status)}
                            tone={
                              report.status === 'completed'
                                ? 'success'
                                : report.status === 'processing'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(report.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleDownloadReport(report.id)}
                              disabled={downloadLoading === report.id}
                              className="text-cyan-600 hover:text-cyan-900 disabled:opacity-50 transition-colors"
                              title={t('reports.downloadReport')}
                            >
                              {downloadLoading === report.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Download size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              disabled={deleteLoading === report.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50 transition-colors"
                              title={t('common.delete')}
                            >
                              {deleteLoading === report.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tablet Table View */}
            <div className="hidden md:block lg:hidden bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('reports.patient')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('reports.format')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('reports.status')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {report.patient ? `${report.patient.first_name} ${report.patient.last_name}` : t('reports.unknownPatient')}
                          </div>
                          {report.patient && (
                            <div className="text-sm text-gray-500">
                              {report.patient.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            report.format === 'SOAP' ? 'bg-blue-100 text-blue-800' :
                            report.format === 'Comprehensive' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {report.format}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <RealtimeStatusBadge
                            label={getStatusLabel(report.status)}
                            tone={
                              report.status === 'completed'
                                ? 'success'
                                : report.status === 'processing'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => handleDownloadReport(report.id)}
                              disabled={downloadLoading === report.id}
                              className="text-cyan-600 hover:text-cyan-900 disabled:opacity-50 transition-colors"
                              title={t('reports.downloadReport')}
                            >
                              {downloadLoading === report.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Download size={16} />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              disabled={deleteLoading === report.id}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50 transition-colors"
                              title={t('common.delete')}
                            >
                              {deleteLoading === report.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredReports.map((report) => (
                <div key={report.id} className="bg-white rounded-lg shadow p-4 border border-gray-100">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-lg mb-1">
                        {report.patient ? `${report.patient.first_name} ${report.patient.last_name}` : t('reports.unknownPatient')}
                      </div>
                      {report.patient && (
                        <div className="text-sm text-gray-600 mb-2">
                          📧 {report.patient.email}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          report.format === 'SOAP' ? 'bg-blue-100 text-blue-800' :
                          report.format === 'Comprehensive' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          📄 {report.format}
                        </span>
                        <RealtimeStatusBadge
                          label={getStatusLabel(report.status)}
                          tone={
                            report.status === 'completed'
                              ? 'success'
                              : report.status === 'processing'
                                ? 'warning'
                                : 'neutral'
                          }
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        📅 {formatDate(report.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleDownloadReport(report.id)}
                      disabled={downloadLoading === report.id}
                      className="flex-1 px-4 py-2 text-sm text-cyan-600 hover:text-cyan-900 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors text-center font-medium disabled:opacity-50"
                      title={t('reports.downloadReport')}
                    >
                      {downloadLoading === report.id ? (
                        <>
                          <Loader2 className="animate-spin mr-2 inline" size={16} />
                          {t('common.downloading')}
                        </>
                      ) : (
                        <>
                          <Download size={16} className="mr-2 inline" />
                          {t('common.download')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      disabled={deleteLoading === report.id}
                      className="flex-1 px-4 py-2 text-sm text-red-600 hover:text-red-900 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-center font-medium disabled:opacity-50"
                      title={t('common.delete')}
                    >
                      {deleteLoading === report.id ? (
                        <>
                          <Loader2 className="animate-spin mr-2 inline" size={16} />
                          {t('common.deleting')}
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} className="mr-2 inline" />
                          {t('common.delete')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {!loading && !error && pagination.pages > 1 && (
              <div className="bg-white rounded-lg shadow border border-gray-200 mt-6">
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  {/* Mobile Pagination */}
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md transition-colors ${
                        pagination.page === 1
                          ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                          : 'text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <ChevronLeft size={16} className="mr-1" />
                      {t('common.previous')}
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.pages}
                      className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md transition-colors ${
                        pagination.page === pagination.pages
                          ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                          : 'text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {t('common.next')}
                      <ChevronRight size={16} className="ml-1" />
                    </button>
                  </div>
                  
                  {/* Desktop Pagination */}
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        {t('common.showing')} <span className="font-medium">{Math.min((pagination.page - 1) * limit + 1, pagination.total)}</span> {t('common.to')}{' '}
                        <span className="font-medium">{Math.min(pagination.page * limit, pagination.total)}</span> {t('common.of')}{' '}
                        <span className="font-medium">{pagination.total}</span> {t('common.results')}
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                          disabled={pagination.page === 1}
                          className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 text-sm font-medium transition-colors ${
                            pagination.page === 1
                              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                              : 'text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                          disabled={pagination.page === pagination.pages}
                          className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 text-sm font-medium transition-colors ${
                            pagination.page === pagination.pages
                              ? 'text-gray-400 cursor-not-allowed bg-gray-100'
                              : 'text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;