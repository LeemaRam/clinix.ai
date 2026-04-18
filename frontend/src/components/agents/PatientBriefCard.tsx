import React from 'react';
import { User } from 'lucide-react';

interface PatientBrief {
  brief: string;
  key_flags: string[];
}

interface PatientBriefCardProps {
  brief: PatientBrief | null;
  loading: boolean;
  error: string | null;
}

const PatientBriefCard: React.FC<PatientBriefCardProps> = ({ brief, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-blue-700">Generating patient brief...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <User className="h-5 w-5 text-red-600" />
          <span className="ml-2 text-red-700">Error generating brief: {error}</span>
        </div>
      </div>
    );
  }

  if (!brief) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start">
        <User className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800">Patient Brief</h3>
          <p className="mt-1 text-sm text-blue-700">{brief.brief}</p>
          {brief.key_flags.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium text-blue-800">Key Flags:</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-blue-700">
                {brief.key_flags.map((flag, index) => (
                  <li key={index}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientBriefCard;