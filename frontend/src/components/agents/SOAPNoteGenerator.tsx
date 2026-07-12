import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { generateSOAPNote } from '../../services/agentService';

interface SOAPNoteGeneratorProps {
  patientId: string;
  transcription?: string;
  consultationReason?: string;
  onSoapGenerated?: (soap: string) => void;
}

const SOAPNoteGenerator: React.FC<SOAPNoteGeneratorProps> = ({
  patientId,
  transcription,
  consultationReason,
  onSoapGenerated,
}) => {
  const [soapNote, setSoapNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [localTranscription, setLocalTranscription] = useState<string>(transcription || '');

  const transcriptionText = transcription?.trim() ? transcription : localTranscription;

  const handleGenerate = async () => {
    if (!transcriptionText?.trim()) {
      setError('Please provide a transcription before generating a SOAP note.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await generateSOAPNote(patientId, transcriptionText, consultationReason);
      const note = result.data?.soapNote || result.soapNote || '';

      if (!note) {
        throw new Error(result.message || 'No SOAP note returned from AI service.');
      }

      setSoapNote(note);
      onSoapGenerated?.(note);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to generate SOAP note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-700" />
          <h5 className="text-lg font-medium text-emerald-900">SOAP Note Generator</h5>
        </div>
        <button
          className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          disabled={loading || !transcriptionText?.trim()}
          onClick={handleGenerate}
        >
          {loading ? 'Generating...' : 'Generate SOAP Note'}
        </button>
      </div>

      {!transcription?.trim() && (
        <div className="mb-4">
          <label className="block mb-2 text-sm font-medium text-emerald-800">Consultation Transcription</label>
          <textarea
            value={localTranscription}
            onChange={(event) => setLocalTranscription(event.target.value)}
            rows={6}
            className="w-full p-3 border border-emerald-300 rounded-lg bg-white text-sm text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Paste or type the consultation transcript here..."
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {soapNote ? (
        <div className="bg-white border border-emerald-200 rounded p-4 text-sm text-emerald-900 whitespace-pre-wrap">
          {soapNote}
        </div>
      ) : (
        <p className="text-emerald-700 text-sm">
          Create a professional SOAP note from the transcription for clinical documentation.
        </p>
      )}
    </div>
  );
};

export default SOAPNoteGenerator;
