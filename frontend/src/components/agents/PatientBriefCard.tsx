import React, { useState } from 'react';
import { User } from 'lucide-react';
import { getPatientBrief } from '../../services/agentService';

interface PatientBriefCardProps {
  patientId: string;
}

const PatientBriefCard: React.FC<PatientBriefCardProps> = ({ patientId }) => {
  const [brief, setBrief] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const generateBrief = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getPatientBrief(patientId);
      setBrief(result.brief || result.data?.brief || 'No brief generated');
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to generate patient brief');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <User className="h-5 w-5 text-blue-600" />
<<<<<<< HEAD
          <h5 className="ml-2 text-lg font-medium text-blue-800">Patient Summary</h5>
=======
          <h5 className="ml-2 text-lg font-medium text-blue-800">🤖 Agent 2: Patient Brief History</h5>
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
        </div>
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={generateBrief}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Brief'}
        </button>
<<<<<<< HEAD
=======
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {brief ? (
        <div
          className="text-sm text-blue-700 whitespace-pre-wrap p-3 bg-white rounded border"
          style={{ lineHeight: '1.6' }}
        >
          {brief}
        </div>
      ) : (
        <p className="text-blue-600 text-center py-4">
          Click "Generate Brief" to get AI-powered patient summary with key medical insights.
        </p>
      )}

      <div className="text-xs text-blue-500 mt-3">
        Powered by Gemini • Updated in real-time
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {brief ? (
        <div
          className="text-sm text-blue-700 whitespace-pre-wrap p-3 bg-white rounded border"
          style={{ lineHeight: '1.6' }}
        >
          {brief}
        </div>
      ) : (
        <p className="text-blue-600 text-center py-4">
          Click "Generate Brief" to get AI-powered patient summary with key medical insights.
        </p>
      )}
    </div>
  );
};

export default PatientBriefCard;
