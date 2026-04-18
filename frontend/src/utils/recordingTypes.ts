/**
 * Get human-readable label for recording type
 * @param recordingType - The recording type from backend
 * @returns Formatted recording type label
 */
export const getRecordingTypeLabel = (recordingType: string): string => {
  switch (recordingType) {
    case 'doctor_patient':
      return 'Doctor & Patient';
    case 'doctor_only':
      return 'Doctor Only';
    case 'doctor_patient_third':
      return 'Doctor, Patient & Third Party';
    default:
      return recordingType || 'Unknown';
  }
};

/**
 * Get icon for recording type
 * @param recordingType - The recording type from backend
 * @returns Icon component or null
 */
export const getRecordingTypeIcon = (recordingType: string) => {
  switch (recordingType) {
    case 'doctor_patient':
      return '👥'; // Two people
    case 'doctor_only':
      return '👨‍⚕️'; // Doctor
    case 'doctor_patient_third':
      return '👥➕'; // Three people
    default:
      return '🎤'; // Microphone
  }
};

/**
 * Get color class for recording type
 * @param recordingType - The recording type from backend
 * @returns Tailwind CSS color classes
 */
export const getRecordingTypeColor = (recordingType: string): string => {
  switch (recordingType) {
    case 'doctor_patient':
      return 'text-blue-600 bg-blue-50';
    case 'doctor_only':
      return 'text-green-600 bg-green-50';
    case 'doctor_patient_third':
      return 'text-purple-600 bg-purple-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}; 