import React, { useState } from 'react';
import { FileBarChart, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReportPreviewModal from './ReportPreviewModal';

interface DemoConsultation {
  id: string;
  patientName: string;
  doctorName: string;
  date: string;
  type: string;
}

const ReportPreviewDemo: React.FC = () => {
  const { t } = useTranslation();
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('');

  // Demo consultation data
  const demoConsultations: DemoConsultation[] = [
    {
      id: '507f1f77bcf86cd799439011',
      patientName: 'María García López',
      doctorName: 'Dr. Carlos Hernández',
      date: '2024-01-15',
      type: 'Consulta General'
    },
    {
      id: '507f1f77bcf86cd799439012',
      patientName: 'Juan Carlos Ruiz',
      doctorName: 'Dr. Ana Martínez',
      date: '2024-01-14',
      type: 'Consulta de Seguimiento'
    }
  ];

  const defaultPdfOptions = {
    includeSummary: true,
    includeMedicalInfo: true,
    includeTranscript: true,
    includePatientDetails: true
  };

  const handlePreviewReport = (consultationId: string) => {
    setSelectedConsultationId(consultationId);
    setShowPreviewModal(true);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">{t('reports.reportPreviewDemo')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('reports.demoDescription')}
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {demoConsultations.map((consultation) => (
              <div key={consultation.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{consultation.patientName}</h3>
                    <p className="text-sm text-gray-600">{consultation.doctorName}</p>
                    <p className="text-sm text-gray-500">{consultation.type} • {consultation.date}</p>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handlePreviewReport(consultation.id)}
                      className="flex items-center px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      title={t('reports.previewAndEditReport')}
                    >
                      <FileBarChart size={16} className="mr-2" />
                      {t('reports.previewReport')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Eye className="text-blue-600 mr-3 mt-1" size={20} />
              <div>
                <h3 className="font-medium text-blue-800 mb-2">{t('reports.howItWorks')}</h3>
                <ol className="text-sm text-blue-900 space-y-1 list-decimal list-inside">
                  <li>{t('reports.step1')}</li>
                  <li>{t('reports.step2')}</li>
                  <li>{t('reports.step3')}</li>
                  <li>{t('reports.step4')}</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview Modal */}
      {showPreviewModal && selectedConsultationId && (
        <ReportPreviewModal
          isOpen={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setSelectedConsultationId('');
          }}
          consultationId={selectedConsultationId}
          pdfOptions={defaultPdfOptions}
        />
      )}
    </div>
  );
};

export default ReportPreviewDemo; 