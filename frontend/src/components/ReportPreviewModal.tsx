import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Download, 
  Loader2, 
  FileText, 
  User, 
  Calendar, 
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import EditableSection from './EditableSection';
import { apiFetch, getAuthHeaders, unwrapApiData } from '../services/apiFetch';

interface PatientInfo {
  name: string;
  age: number;
  gender: string;
  date_of_birth: string;
  consultation_date: string;
  consultation_time: string;
  doctor_name: string;
  doctor_email: string;
}

interface ReportSections {
  title: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  vital_signs: string;
  neurological_exam: string;
  pharmacological_treatment: string;
  self_care_measures: string;
  dietary_recommendations: string;
  follow_up: string;
  signature: string;
}

interface MedicalAnalysis {
  symptoms: string[];
  medical_history: string[];
  current_medications: string[];
  diagnosis: string[];
  treatment_plan: string[];
  follow_up: string[];
}

interface StructuredContent {
  patient_info: PatientInfo;
  sections: ReportSections;
  medical_analysis: MedicalAnalysis;
  summary: string;
  transcription_confidence: number;
  transcription_duration: number;
}

const createDefaultStructuredContent = (): StructuredContent => ({
  patient_info: {
    name: '',
    age: 0,
    gender: '',
    date_of_birth: '',
    consultation_date: '',
    consultation_time: '',
    doctor_name: '',
    doctor_email: ''
  },
  sections: {
    title: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    vital_signs: '',
    neurological_exam: '',
    pharmacological_treatment: '',
    self_care_measures: '',
    dietary_recommendations: '',
    follow_up: '',
    signature: ''
  },
  medical_analysis: {
    symptoms: [],
    medical_history: [],
    current_medications: [],
    diagnosis: [],
    treatment_plan: [],
    follow_up: []
  },
  summary: '',
  transcription_confidence: 0,
  transcription_duration: 0
});

const normalizeStructuredContent = (raw: unknown): StructuredContent => {
  const base = createDefaultStructuredContent();
  const source = (raw && typeof raw === 'object') ? raw as Record<string, any> : {};
  const rawSections = (source.sections && typeof source.sections === 'object')
    ? source.sections as Record<string, any>
    : {};
  const rawPatientInfo = (source.patient_info && typeof source.patient_info === 'object')
    ? source.patient_info as Record<string, any>
    : {};
  const rawMedicalAnalysis = (source.medical_analysis && typeof source.medical_analysis === 'object')
    ? source.medical_analysis as Record<string, any>
    : {};

  return {
    patient_info: {
      ...base.patient_info,
      ...rawPatientInfo,
      name: String(rawPatientInfo.name ?? base.patient_info.name),
      age: Number(rawPatientInfo.age ?? base.patient_info.age),
      gender: String(rawPatientInfo.gender ?? base.patient_info.gender),
      date_of_birth: String(rawPatientInfo.date_of_birth ?? base.patient_info.date_of_birth),
      consultation_date: String(rawPatientInfo.consultation_date ?? base.patient_info.consultation_date),
      consultation_time: String(rawPatientInfo.consultation_time ?? base.patient_info.consultation_time),
      doctor_name: String(rawPatientInfo.doctor_name ?? base.patient_info.doctor_name),
      doctor_email: String(rawPatientInfo.doctor_email ?? base.patient_info.doctor_email),
    },
    sections: {
      ...base.sections,
      ...rawSections,
      title: String(rawSections.title ?? base.sections.title),
      subjective: String(rawSections.subjective ?? rawSections.summary ?? base.sections.subjective),
      objective: String(rawSections.objective ?? base.sections.objective),
      assessment: String(rawSections.assessment ?? base.sections.assessment),
      plan: String(rawSections.plan ?? rawSections.recommendations ?? base.sections.plan),
      vital_signs: String(rawSections.vital_signs ?? base.sections.vital_signs),
      neurological_exam: String(rawSections.neurological_exam ?? base.sections.neurological_exam),
      pharmacological_treatment: String(rawSections.pharmacological_treatment ?? base.sections.pharmacological_treatment),
      self_care_measures: String(rawSections.self_care_measures ?? base.sections.self_care_measures),
      dietary_recommendations: String(rawSections.dietary_recommendations ?? base.sections.dietary_recommendations),
      follow_up: String(rawSections.follow_up ?? base.sections.follow_up),
      signature: String(rawSections.signature ?? base.sections.signature),
    },
    medical_analysis: {
      symptoms: Array.isArray(rawMedicalAnalysis.symptoms) ? rawMedicalAnalysis.symptoms.map(String) : [],
      medical_history: Array.isArray(rawMedicalAnalysis.medical_history) ? rawMedicalAnalysis.medical_history.map(String) : [],
      current_medications: Array.isArray(rawMedicalAnalysis.current_medications) ? rawMedicalAnalysis.current_medications.map(String) : [],
      diagnosis: Array.isArray(rawMedicalAnalysis.diagnosis) ? rawMedicalAnalysis.diagnosis.map(String) : [],
      treatment_plan: Array.isArray(rawMedicalAnalysis.treatment_plan) ? rawMedicalAnalysis.treatment_plan.map(String) : [],
      follow_up: Array.isArray(rawMedicalAnalysis.follow_up) ? rawMedicalAnalysis.follow_up.map(String) : [],
    },
    summary: String(source.summary ?? rawSections.summary ?? ''),
    transcription_confidence: Number(source.transcription_confidence ?? 0),
    transcription_duration: Number(source.transcription_duration ?? 0),
  };
};

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultationId: string;
  pdfOptions: {
    includeSummary: boolean;
    includeMedicalInfo: boolean;
    includeTranscript: boolean;
    includePatientDetails: boolean;
  };
}

const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  consultationId,
  pdfOptions
}) => {
  const { t } = useTranslation();
  const [structuredContent, setStructuredContent] = useState<StructuredContent | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const [editedContent, setEditedContent] = useState<Partial<ReportSections>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Generate preview
  const generatePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ preview_id?: string; structured_content?: StructuredContent }>({
        path: `/consultations/${consultationId}/report/preview`,
        method: 'POST',
        data: {
          options: pdfOptions,
          generatedBy: localStorage.getItem('user_name') || 'System'
        },
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const payload = unwrapApiData<{ preview_id?: string; structured_content?: StructuredContent }>(response.data as any);

      if (!payload.structured_content || !payload.preview_id) {
        throw new Error(t('reports.previewGenerationFailed'));
      }

      const normalizedContent = normalizeStructuredContent(payload.structured_content);
      setStructuredContent(normalizedContent);
      setPreviewId(payload.preview_id);
      setEditedContent(normalizedContent.sections);
    } catch (err: any) {
      setError(err.response?.data?.error || t('reports.previewGenerationFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Save changes to preview
  const saveChanges = async () => {
    if (!previewId || !structuredContent) return;

    setSaving(true);
    try {
      const updatedStructuredContent = {
        ...structuredContent,
        sections: { ...structuredContent.sections, ...editedContent }
      };

      await apiFetch({
        path: `/consultations/${consultationId}/report/preview/${previewId}`,
        method: 'PUT',
        data: { structured_content: updatedStructuredContent },
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      setStructuredContent(updatedStructuredContent);
      setHasUnsavedChanges(false);
      toast.success(t('reports.changesSaved'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('reports.saveChangesFailed'));
    } finally {
      setSaving(false);
    }
  };

  // Generate final PDF
  const generateFinalPDF = async () => {
    if (!previewId) return;

    // Save changes first if there are any
    if (hasUnsavedChanges) {
      await saveChanges();
    }

    setGenerating(true);
    try {
      const response = await apiFetch<Blob>({
        path: `/consultations/${consultationId}/report/preview/${previewId}/generate`,
        method: 'POST',
        headers: getAuthHeaders(),
        responseType: 'blob'
      });

      // Create download link
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `consultation-report-${consultationId}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(fileURL);

      toast.success(t('reports.reportGenerated'));
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('reports.reportFailed'));
    } finally {
      setGenerating(false);
    }
  };

  // Handle section edit
  const handleEditSection = (sectionKey: string) => {
    setEditingSections(prev => new Set([...prev, sectionKey]));
  };

  // Handle section save
  const handleSaveSection = (sectionKey: string) => {
    setEditingSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionKey);
      return newSet;
    });
    setHasUnsavedChanges(true);
  };

  // Handle section cancel
  const handleCancelSection = (sectionKey: string) => {
    setEditingSections(prev => {
      const newSet = new Set(prev);
      newSet.delete(sectionKey);
      return newSet;
    });
    if (structuredContent) {
      setEditedContent(prev => ({
        ...prev,
        [sectionKey]: structuredContent.sections?.[sectionKey as keyof ReportSections] ?? ''
      }));
    }
  };

  // Handle content change
  const handleContentChange = (sectionKey: string, value: string) => {
    setEditedContent(prev => ({
      ...prev,
      [sectionKey]: value
    }));
  };

  // Load preview when modal opens
  useEffect(() => {
    if (isOpen && consultationId) {
      generatePreview();
    }
  }, [isOpen, consultationId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStructuredContent(null);
      setPreviewId(null);
      setEditingSections(new Set());
      setEditedContent({});
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sectionLabels = {
    subjective: t('reports.subjective'),
    objective: t('reports.objective'),
    assessment: t('reports.assessment'),
    plan: t('reports.plan'),
    vital_signs: t('reports.vitalSigns'),
    neurological_exam: t('reports.neurologicalExam'),
    pharmacological_treatment: t('reports.pharmacologicalTreatment'),
    self_care_measures: t('reports.selfCareMeasures'),
    dietary_recommendations: t('reports.dietaryRecommendations'),
    follow_up: t('reports.followUp')
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{t('reports.reportPreview')}</h2>
            <p className="text-sm text-gray-600 mt-1">{t('reports.editAndGenerate')}</p>
          </div>
          <div className="flex items-center space-x-3">
            {hasUnsavedChanges && (
              <div className="flex items-center text-amber-600 text-sm">
                <AlertCircle size={16} className="mr-1" />
                {t('reports.unsavedChanges')}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="animate-spin mr-3" size={24} />
              <span className="text-lg">{t('reports.generatingPreview')}</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-center text-red-700">
              <AlertCircle className="mr-3" size={20} />
              <div>
                <h3 className="font-medium">{t('reports.previewError')}</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          ) : structuredContent ? (
            <div className="space-y-6">
              {/* Patient Information Header */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <User className="text-blue-600 mr-2" size={20} />
                  <h3 className="text-lg font-semibold text-blue-800">{t('reports.patientInformation')}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">{t('reports.patient')}:</span>
                    <p className="text-blue-900">{structuredContent.patient_info?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">{t('reports.age', { defaultValue: 'Age' })}:</span>
                    <p className="text-blue-900">
                      {Number(structuredContent.patient_info?.age) > 0
                        ? `${structuredContent.patient_info.age} ${t('patients.years')}`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">{t('patients.gender')}:</span>
                    <p className="text-blue-900">{structuredContent.patient_info?.gender || '-'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">{t('patients.date')}:</span>
                    <p className="text-blue-900">{structuredContent.patient_info?.consultation_date || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Editable Report Sections */}
              <div className="space-y-4">
                {Object.entries(sectionLabels).map(([sectionKey, label]) => {
                  const isEditing = editingSections.has(sectionKey);
                  const content = editedContent[sectionKey as keyof ReportSections]
                    ?? structuredContent.sections?.[sectionKey as keyof ReportSections]
                    ?? '';
                  
                  return (
                    <EditableSection
                      key={sectionKey}
                      title={label}
                      content={content}
                      isEditing={isEditing}
                      onEdit={() => handleEditSection(sectionKey)}
                      onSave={() => handleSaveSection(sectionKey)}
                      onCancel={() => handleCancelSection(sectionKey)}
                      onChange={(value) => handleContentChange(sectionKey, value)}
                      placeholder={t('reports.enterContent')}
                    />
                  );
                })}
              </div>

              {/* Medical Analysis Summary */}
              {structuredContent.medical_analysis && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <FileText className="text-green-600 mr-2" size={20} />
                    <h3 className="text-lg font-semibold text-green-800">{t('reports.medicalAnalysis')}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(structuredContent.medical_analysis).map(([key, items]) => (
                      Array.isArray(items) && items.length > 0 && (
                        <div key={key}>
                          <h4 className="font-medium text-green-700 mb-2">
                            {t(`transcription.${key}`)}
                          </h4>
                          <ul className="text-sm text-green-900 space-y-1">
                            {(items as string[]).map((item: string, index: number) => (
                              <li key={index} className="flex items-start">
                                <span className="text-green-400 mr-2">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Transcription Summary */}
              {structuredContent.summary && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <Calendar className="text-purple-600 mr-2" size={20} />
                    <h3 className="text-lg font-semibold text-purple-800">{t('reports.consultationSummary')}</h3>
                  </div>
                  <p className="text-purple-900">{structuredContent.summary}</p>
                  <div className="mt-4 flex items-center space-x-4 text-sm text-purple-700">
                    <div className="flex items-center">
                      <Clock size={14} className="mr-1" />
                      {t('transcription.duration')}: {Math.round(structuredContent.transcription_duration)}s
                    </div>
                    <div className="flex items-center">
                      <CheckCircle size={14} className="mr-1" />
                      {t('transcription.confidence')}: {(structuredContent.transcription_confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              {t('reports.noPreviewAvailable')}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {structuredContent && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {hasUnsavedChanges && (
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin mr-2" size={16} />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      {t('reports.saveChanges')}
                    </>
                  )}
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={generateFinalPDF}
                disabled={generating || hasUnsavedChanges}
                className="flex items-center px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    {t('reports.generating')}
                  </>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    {t('reports.downloadPDF')}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPreviewModal; 