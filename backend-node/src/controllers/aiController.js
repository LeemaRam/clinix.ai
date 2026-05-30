import { checkDrugSafety } from '../services/openaiService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const drugSafetyCheck = asyncHandler(async (req, res) => {
  const { medications, patientInfo, patientFiles, language = 'en' } = req.body;

  if (!medications || !Array.isArray(medications)) {
    return res.status(400).json({ error: 'Medications array is required' });
  }

  const result = await checkDrugSafety({
    medications,
    patientInfo: patientInfo || {},
    patientFiles: patientFiles || [],
    language
  });

  res.json(result);
});