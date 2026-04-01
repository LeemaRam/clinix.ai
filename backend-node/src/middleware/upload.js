import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env.js';

const audioDir = path.resolve(env.UPLOAD_AUDIO_DIR);
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, audioDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

const allowed = new Set(['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/x-m4a']);

export const uploadAudio = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new Error(`Unsupported audio type: ${file.mimetype}`));
    }
    return cb(null, true);
  }
});
