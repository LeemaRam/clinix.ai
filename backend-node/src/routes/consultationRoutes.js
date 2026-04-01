import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { uploadAudio } from '../middleware/upload.js';
import {
  createConsultation,
  deleteConsultation,
  generateConsultationReportPdf,
  generateReportPreview,
  getTranscriptionByConsultation,
  listConsultations,
  patchTranscriptionSegment,
  updateReportPreview,
  uploadAudio as uploadAudioHandler
} from '../controllers/consultationController.js';

const router = Router();

router.use(authRequired);
router.get('/', listConsultations);
router.post('/', createConsultation);
router.delete('/:id', deleteConsultation);
router.post('/:id/upload-audio', uploadAudio.single('audio'), uploadAudioHandler);
router.get('/transcriptions/:consultationId', getTranscriptionByConsultation);
router.patch('/transcriptions/:consultationId/segments/:segmentId', patchTranscriptionSegment);
router.post('/:consultationId/report', generateConsultationReportPdf);
router.post('/:consultationId/report/preview', generateReportPreview);
router.put('/:consultationId/report/preview/:previewId', updateReportPreview);

export default router;
