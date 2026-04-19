import { checkDrugSafety } from '../services/pythonService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const drugSafetyCheck = asyncHandler(async (req, res) => {
  const { medications, patientInfo, language = 'en' } = req.body;

  if (!medications || !Array.isArray(medications)) {
    return res.status(400).json({ error: 'Medications array is required' });
  }

  const result = await checkDrugSafety({
    medications,
    patientInfo: patientInfo || {},
    language
  });

  res.json(result);
});