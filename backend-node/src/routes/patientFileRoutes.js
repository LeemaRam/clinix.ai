import express, { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadPatientFile, listPatientFiles, downloadPatientFile, deletePatientFile } from '../controllers/patientFileController.js';

const uploadDirectory = path.join('uploads', 'patient_files');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.patientId}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();
router.use(authRequired);
router.post('/:patientId/files', upload.single('file'), uploadPatientFile);
router.get('/:patientId/files', listPatientFiles);
router.get('/:patientId/files/:fileId', downloadPatientFile);
router.delete('/:patientId/files/:fileId', deletePatientFile);
export default router;