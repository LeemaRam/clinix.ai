import { extractMedicalAnalysis as openaiExtractMedicalAnalysis } from './openaiService.js';

export const extractMedicalAnalysis = async (transcript) => {
  return openaiExtractMedicalAnalysis(transcript);
};
