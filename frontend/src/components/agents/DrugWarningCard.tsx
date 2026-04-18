import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface DrugWarning {
  warnings: string[];
  interactions: Array<{
    drugs: string;
    description: string;
    severity: string;
    color: string;
  }>;
  safe: boolean;
  note?: string;
  error?: string;
}

interface DrugWarningCardProps {
  drugCheck: DrugWarning | null;
  loading: boolean;
  error: string | null;
}

const DrugWarningCard: React.FC<DrugWarningCardProps> = ({ drugCheck, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-blue-700">Checking drug safety...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <span className="ml-2 text-red-700">Error checking drug safety: {error}</span>
        </div>
      </div>
    );
  }

  if (!drugCheck) {
    return null;
  }

  const hasWarnings = drugCheck.warnings.length > 0;
  const hasInteractions = drugCheck.interactions.length > 0;

  if (!hasWarnings && !hasInteractions && drugCheck.safe) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="ml-2 text-green-700">No drug safety concerns detected.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start">
        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">Drug Safety Alerts</h3>

          {drugCheck.warnings.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium text-yellow-800">Warnings:</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-yellow-700">
                {drugCheck.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {drugCheck.interactions.length > 0 && (
            <div className="mt-2">
              <h4 className="text-sm font-medium text-yellow-800">Interactions:</h4>
              <ul className="mt-1 list-disc list-inside text-sm text-yellow-700">
                {drugCheck.interactions.map((interaction, index) => (
                  <li key={index}>
                    <strong>{interaction.drugs}:</strong> {interaction.description} ({interaction.severity})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {drugCheck.note && (
            <div className="mt-2">
              <p className="text-sm text-yellow-700">{drugCheck.note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DrugWarningCard;