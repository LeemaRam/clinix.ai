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
import { saveReportPreview } from '../services/reportService';
import { formatFollowUpDays, formatSoapList, formatSoapText } from '../utils/soapFormatter';

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

interface DrugSafetyContent {
  warnings: string[];
  interactions: string[];
  recommendations: string[];
  safe: boolean;
  riskLevel?: string;
  rxNorm?: Record<string, any>;
}

interface StructuredContent {
  patient_info: PatientInfo;
  sections: ReportSections;
  medical_analysis: MedicalAnalysis;
  drug_safety: DrugSafetyContent;
  summary: string;
  transcription_confidence: number;
  transcription_duration: number;
  follow_up_days: number;
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
  drug_safety: {
    warnings: [],
    interactions: [],
    recommendations: [],
    safe: true
  },
  summary: '',
  transcription_confidence: 0,
  transcription_duration: 0,
  follow_up_days: 7
});

const normalizeTextValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text.toLowerCase() === 'null' ? '' : text;
};

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
      name: normalizeTextValue(rawPatientInfo.name ?? base.patient_info.name),
      age: Number(rawPatientInfo.age ?? base.patient_info.age),
      gender: normalizeTextValue(rawPatientInfo.gender ?? base.patient_info.gender),
      date_of_birth: normalizeTextValue(rawPatientInfo.date_of_birth ?? base.patient_info.date_of_birth),
      consultation_date: normalizeTextValue(rawPatientInfo.consultation_date ?? base.patient_info.consultation_date),
      consultation_time: normalizeTextValue(rawPatientInfo.consultation_time ?? base.patient_info.consultation_time),
      doctor_name: normalizeTextValue(rawPatientInfo.doctor_name ?? base.patient_info.doctor_name),
      doctor_email: normalizeTextValue(rawPatientInfo.doctor_email ?? base.patient_info.doctor_email),
    },
    sections: {
      ...base.sections,
      ...rawSections,
      title: normalizeTextValue(rawSections.title ?? base.sections.title),
      subjective: normalizeTextValue(rawSections.subjective ?? rawSections.summary ?? base.sections.subjective),
      objective: normalizeTextValue(rawSections.objective ?? base.sections.objective),
      assessment: normalizeTextValue(rawSections.assessment ?? base.sections.assessment),
      plan: normalizeTextValue(rawSections.plan ?? rawSections.recommendations ?? base.sections.plan),
      vital_signs: normalizeTextValue(rawSections.vital_signs ?? base.sections.vital_signs),
      neurological_exam: normalizeTextValue(rawSections.neurological_exam ?? base.sections.neurological_exam),
      pharmacological_treatment: normalizeTextValue(rawSections.pharmacological_treatment ?? base.sections.pharmacological_treatment),
      self_care_measures: normalizeTextValue(rawSections.self_care_measures ?? base.sections.self_care_measures),
      dietary_recommendations: normalizeTextValue(rawSections.dietary_recommendations ?? base.sections.dietary_recommendations),
      follow_up: normalizeTextValue(rawSections.follow_up ?? base.sections.follow_up),
      signature: normalizeTextValue(rawSections.signature ?? base.sections.signature),
    },
    medical_analysis: {
      symptoms: Array.isArray(rawMedicalAnalysis.symptoms) ? rawMedicalAnalysis.symptoms.map(String) : [],
      medical_history: Array.isArray(rawMedicalAnalysis.medical_history) ? rawMedicalAnalysis.medical_history.map(String) : [],
      current_medications: Array.isArray(rawMedicalAnalysis.current_medications) ? rawMedicalAnalysis.current_medications.map(String) : [],
      diagnosis: Array.isArray(rawMedicalAnalysis.diagnosis) ? rawMedicalAnalysis.diagnosis.map(String) : [],
      treatment_plan: Array.isArray(rawMedicalAnalysis.treatment_plan) ? rawMedicalAnalysis.treatment_plan.map(String) : [],
      follow_up: Array.isArray(rawMedicalAnalysis.follow_up) ? rawMedicalAnalysis.follow_up.map(String) : [],
    },
    summary: normalizeTextValue(source.summary ?? rawSections.summary ?? ''),
    drug_safety: {
      warnings: Array.isArray(source.drug_safety?.warnings) ? source.drug_safety.warnings.map(String) : [],
      interactions: Array.isArray(source.drug_safety?.interactions) ? source.drug_safety.interactions.map(String) : [],
      recommendations: Array.isArray(source.drug_safety?.recommendations) ? source.drug_safety.recommendations.map(String) : [],
      safe: source.drug_safety?.safe !== false,
      riskLevel: source.drug_safety?.riskLevel ?? undefined,
      rxNorm: source.drug_safety?.rxNorm ?? undefined
    },

    transcription_confidence: Number(source.transcription_confidence ?? 0),
    transcription_duration: Number(source.transcription_duration ?? 0),
    follow_up_days: Number(source.follow_up_days ?? 7)
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
  const [savingReport, setSavingReport] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const [editedContent, setEditedContent] = useState<Partial<ReportSections>>({});
  const [editedMedicalAnalysis, setEditedMedicalAnalysis] = useState<Partial<MedicalAnalysis>>({});
  const [editedFollowUpDays, setEditedFollowUpDays] = useState<number>(7);
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
      console.debug('[ReportPreviewModal] Loaded structured preview', { consultationId, normalizedContent });
      setStructuredContent(normalizedContent);
      setPreviewId(payload.preview_id);
      setEditedContent(normalizedContent.sections);
      setEditedMedicalAnalysis({
        ...normalizedContent.medical_analysis,
        current_medications: normalizedContent.medical_analysis.current_medications,
        follow_up: normalizedContent.medical_analysis.follow_up
      });
      setEditedFollowUpDays(normalizedContent.follow_up_days || 7);
    } catch (err: any) {
      setError(err.response?.data?.error || t('reports.previewGenerationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const getUpdatedStructuredContent = (): StructuredContent | null => {
    if (!structuredContent) return null;
    return {
      ...structuredContent,
      sections: { ...structuredContent.sections, ...editedContent },
      medical_analysis: { ...structuredContent.medical_analysis, ...editedMedicalAnalysis },
      follow_up_days: editedFollowUpDays
    };
  };

  const saveReport = async () => {
    if (!previewId || !structuredContent) return;

    const updatedStructuredContent = getUpdatedStructuredContent();
    if (!updatedStructuredContent) return;

    setSavingReport(true);
    try {
      await saveReportPreview(consultationId, previewId, updatedStructuredContent, localStorage.getItem('user_name') || 'System');
      setStructuredContent(updatedStructuredContent);
      setEditedContent(updatedStructuredContent.sections);
      setEditedMedicalAnalysis({ ...updatedStructuredContent.medical_analysis });
      setHasUnsavedChanges(false);
      toast.success(t('reports.reportSaved', { defaultValue: 'Report saved successfully' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('reports.saveReportFailed', { defaultValue: 'Failed to save report' }));
    } finally {
      setSavingReport(false);
    }
  };

  // Save changes to preview
  const saveChanges = async () => {
    if (!previewId || !structuredContent) return;

    setSaving(true);
    try {
      const updatedStructuredContent = getUpdatedStructuredContent();
      if (!updatedStructuredContent) return;

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
      setEditedContent(updatedStructuredContent.sections);
      setEditedMedicalAnalysis({
        ...updatedStructuredContent.medical_analysis
      });
      setHasUnsavedChanges(false);
      toast.success(t('reports.changesSaved', { defaultValue: 'Changes saved successfully' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('reports.saveChangesFailed', { defaultValue: 'Failed to save changes' }));
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
      const updatedStructuredContent = {
        ...structuredContent,
        sections: { ...structuredContent.sections, ...editedContent },
        medical_analysis: { ...structuredContent.medical_analysis, ...editedMedicalAnalysis },
        follow_up_days: editedFollowUpDays
      };

      const response = await apiFetch<Blob>({
        path: `/consultations/${consultationId}/report/preview/${previewId}/generate`,
        method: 'POST',
        data: { structured_content: updatedStructuredContent },
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
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
      if (sectionKey === 'current_medications') {
        setEditedMedicalAnalysis(prev => ({
          ...prev,
          current_medications: structuredContent.medical_analysis.current_medications
        }));
        return;
      }

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

  const handleMedicalAnalysisChange = (fieldKey: keyof MedicalAnalysis, value: string) => {
    const normalized = value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    setEditedMedicalAnalysis(prev => ({
      ...prev,
      [fieldKey]: normalized
    }));
    setHasUnsavedChanges(true);
  };

  const handleFollowUpDaysChange = (value: number) => {
    setEditedFollowUpDays(value);
    setHasUnsavedChanges(true);
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
      setEditedMedicalAnalysis({});
      setEditedFollowUpDays(7);
      setHasUnsavedChanges(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sectionLabels = {
    subjective: t('reports.subjective', { defaultValue: 'Subjective' }),
    objective: t('reports.objective', { defaultValue: 'Objective' }),
    assessment: t('reports.assessment', { defaultValue: 'Assessment' }),
    plan: t('reports.plan', { defaultValue: 'Plan' }),
    vital_signs: t('reports.vitalSigns', { defaultValue: 'Vital Signs' }),
    neurological_exam: t('reports.neurologicalExam', { defaultValue: 'Neurological Examination' }),
    pharmacological_treatment: t('reports.pharmacologicalTreatment', { defaultValue: 'Pharmacological Treatment' }),
    self_care_measures: t('reports.selfCareMeasures', { defaultValue: 'Self-Care Measures' }),
    dietary_recommendations: t('reports.dietaryRecommendations', { defaultValue: 'Dietary Recommendations' }),
    follow_up: t('reports.followUp', { defaultValue: 'Follow-up' })
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
                    <span className="font-medium text-blue-700">{t('reports.patient', { defaultValue: 'Patient' })}:</span>
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
                {Object.entries(sectionLabels)
                  .filter(([sectionKey]) => sectionKey !== 'follow_up' || structuredContent.sections.follow_up?.trim())
                  .map(([sectionKey, label]) => {
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

              {/* Medication + Follow-up Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <EditableSection
                    title={t('transcription.current_medications', { defaultValue: 'Medications' })}
                    content={editedMedicalAnalysis.current_medications !== undefined
                      ? editedMedicalAnalysis.current_medications.join('\n')
                      : structuredContent.medical_analysis.current_medications.join('\n')}
                    isEditing={editingSections.has('current_medications')}
                    onEdit={() => handleEditSection('current_medications')}
                    onSave={() => handleSaveSection('current_medications')}
                    onCancel={() => handleCancelSection('current_medications')}
                    onChange={(value) => handleMedicalAnalysisChange('current_medications', value)}
                    placeholder={t('reports.enterMedications', { defaultValue: 'Enter current medications, one per line' })}
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-800 uppercase tracking-wide">
                      {t('reports.followUpDays', { defaultValue: 'Follow-up Days' })}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="number"
                      min={0}
                      value={editedFollowUpDays}
                      onChange={(event) => handleFollowUpDaysChange(Number(event.target.value))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <p className="text-sm text-slate-500">
                      {t('reports.followUpDaysHint', { defaultValue: 'Update the follow-up interval for this consultation.' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Medical Analysis Summary */}
              {structuredContent.medical_analysis && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <FileText className="text-green-600 mr-2" size={20} />
                    <h3 className="text-lg font-semibold text-green-800">{t('reports.medicalAnalysis')}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(structuredContent.medical_analysis)
                      .filter(([key]) => key !== 'follow_up')
                      .map(([key, items]) => (
                        Array.isArray(items) && items.length > 0 && (
                          <div key={key}>
                            <h4 className="font-medium text-green-700 mb-2">
                              {t(`transcription.${key}`, { defaultValue: key.replace(/_/g, ' ') })}
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

              {/* Drug Safety Summary */}
              {(structuredContent.drug_safety.warnings.length > 0 || structuredContent.drug_safety.interactions.length > 0 || structuredContent.drug_safety.recommendations.length > 0 || typeof structuredContent.drug_safety.safe === 'boolean') && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <AlertCircle className="text-amber-600 mr-2" size={20} />
                    <h3 className="text-lg font-semibold text-amber-800">{t('reports.drugSafetyTitle', { defaultValue: 'Medication Safety' })}</h3>
                  </div>

                  {structuredContent.drug_safety.riskLevel && (
                    <div className="mb-3">
                      <h4 className="font-medium text-amber-700 mb-2">{t('reports.drugSafetyRiskLevel', { defaultValue: 'Risk Level' })}</h4>
                      <p className="text-sm text-amber-900">{structuredContent.drug_safety.riskLevel}</p>
                    </div>
                  )}

                  {structuredContent.drug_safety.warnings.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-amber-700 mb-2">{t('reports.drugSafetyWarnings', { defaultValue: 'Warnings' })}</h4>
                      <ul className="text-sm text-amber-900 space-y-1">
                        {structuredContent.drug_safety.warnings.map((item, index) => (
                          <li key={`warning-${index}`} className="flex items-start">
                            <span className="text-amber-500 mr-2">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {structuredContent.drug_safety.interactions.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-amber-700 mb-2">{t('reports.drugSafetyInteractions', { defaultValue: 'Interactions' })}</h4>
                      <ul className="text-sm text-amber-900 space-y-1">
                        {structuredContent.drug_safety.interactions.map((item, index) => (
                          <li key={`interaction-${index}`} className="flex items-start">
                            <span className="text-amber-500 mr-2">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {structuredContent.drug_safety.recommendations.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-medium text-amber-700 mb-2">{t('reports.drugSafetyRecommendations', { defaultValue: 'Recommendations' })}</h4>
                      <ul className="text-sm text-amber-900 space-y-1">
                        {structuredContent.drug_safety.recommendations.map((item, index) => (
                          <li key={`recommendation-${index}`} className="flex items-start">
                            <span className="text-amber-500 mr-2">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {structuredContent.drug_safety.warnings.length === 0 && structuredContent.drug_safety.interactions.length === 0 && structuredContent.drug_safety.recommendations.length === 0 && (
                    <p className="text-sm text-amber-900">{structuredContent.drug_safety.safe ? t('reports.drugSafetyNoIssues', { defaultValue: 'No drug safety issues were detected.' }) : t('reports.drugSafetyReviewRequired', { defaultValue: 'No drug safety warnings were generated. Please review manually if needed.' })}</p>
                  )}
                </div>
              )}

              {/* Transcription Summary */}
              {structuredContent.summary && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <Calendar className="text-purple-600 mr-2" size={20} />
                    <h3 className="text-lg font-semibold text-purple-800">{t('reports.consultationSummary', { defaultValue: 'Consultation Summary' })}</h3>
                  </div>
                  <p className="text-purple-900">{structuredContent.summary}</p>
                  <div className="mt-4 flex items-center space-x-4 text-sm text-purple-700">
                    <div className="flex items-center">
                      <Clock size={14} className="mr-1" />
                      {t('transcription.duration')}: {Math.round(structuredContent.transcription_duration)}s
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
                onClick={saveReport}
                disabled={savingReport || generating}
                className="flex items-center px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {savingReport ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    {t('reports.savingReport', { defaultValue: 'Saving Report' })}
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    {t('reports.saveReport', { defaultValue: 'Save Report' })}
                  </>
                )}
              </button>
              <button
                onClick={generateFinalPDF}
                disabled={generating || hasUnsavedChanges}
                className="flex items-center px-6 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    {t('reports.generating', { defaultValue: 'Generating' })}
                  </>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    {t('reports.downloadPDF', { defaultValue: 'Download PDF' })}
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