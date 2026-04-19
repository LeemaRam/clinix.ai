import React, { useState, useRef } from 'react';
import { Upload, File, X, Loader2, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { uploadPatientFile, getPatientFiles, deletePatientFile } from '../services/patientService';

interface FileUploadPanelProps {
  patientId: string;
}

interface PatientFile {
  _id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

const normalizeFiles = (payload: unknown): PatientFile[] => {
  if (Array.isArray(payload)) {
    return payload as PatientFile[];
  }

  if (payload && typeof payload === 'object') {
    const maybeData = (payload as { data?: unknown }).data;
    if (Array.isArray(maybeData)) {
      return maybeData as PatientFile[];
    }
  }

  return [];
};

const FileUploadPanel: React.FC<FileUploadPanelProps> = ({ patientId }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetchFiles();
  }, [patientId]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await getPatientFiles(patientId);
      setFiles(normalizeFiles(response.data));
    } catch (err) {
      setError('Failed to load files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      setError('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      await uploadPatientFile(patientId, formData);
      await uploadPatientFile(patientId, formData);
      await fetchFiles();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      await deletePatientFile(patientId, fileId);
      await fetchFiles();
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    try {
      // This would typically call a download endpoint
      // For now, we'll just show an alert
      alert(`Download functionality for ${fileName} would be implemented here`);
    } catch (err) {
      console.error('Failed to download file', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    return '📄';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Patient Files</h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
        >
          {uploading ? (
            <Loader2 size={16} className="animate-spin mr-2" />
          ) : (
            <Upload size={16} className="mr-2" />
          )}
          Upload File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {Array.isArray(files) && files.map((file) => (
          <div key={file._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{getFileIcon(file.mimeType)}</span>
              <div>
                <p className="font-medium text-gray-900">{file.originalName}</p>
                <p className="text-sm text-gray-500">
                  {formatFileSize(file.size)} • Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleDownloadFile(file._id, file.originalName)}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg"
                title="Download"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => handleDeleteFile(file._id)}
                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                title="Delete"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}

        {(!Array.isArray(files) || files.length === 0) && (
          <div className="text-center py-8 text-gray-500">
            <File size={48} className="mx-auto mb-4 opacity-50" />
            <p>No files uploaded yet</p>
            <p className="text-sm">Upload patient documents, images, or reports</p>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        Supported formats: PDF, DOC, DOCX, JPG, PNG, TXT (max 10MB)
      </div>
    </div>
  );
};

export default FileUploadPanel;