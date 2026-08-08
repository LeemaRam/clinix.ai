# Clinix.ai Node API (Express)

This service is the main orchestration API for frontend clients.
It keeps existing frontend route contracts and delegates AI-heavy operations to the FastAPI service.

## Folder Structure

- `src/config` - environment and database connection
- `src/controllers` - route handlers
- `src/middleware` - auth, upload, errors
- `src/models` - MongoDB Mongoose models
- `src/routes` - API route modules
- `src/services` - external service clients (FastAPI AI)
- `src/utils` - shared helpers/serializers

## Environment Variables

Copy `.env.example` to `.env` and set values:

- `PORT` - API port (default `5000`)
- `MONGODB_URI` - MongoDB URI
- `JWT_SECRET` - JWT signing secret
- `JWT_EXPIRES_IN` - token lifetime (default `7d`)
- `CORS_ORIGIN` - allowed origins (comma-separated), e.g. frontend App Service URL(s)
- `FRONTEND_URL` - frontend URL used for Socket.IO and CORS fallback
- `DEMO_MODE` - when true, skips external speech-to-text and uses predefined demo transcript with simulated progress
- `AI_SERVICE_URL` - FastAPI service URL (preferred)
- `PYTHON_AI_SERVICE_URL` - FastAPI service URL (backward-compatible alias)
- `GOOGLE_APPLICATION_CREDENTIALS` - path to Google service account JSON for Speech-to-Text (environment variable)
- `GOOGLE_CLOUD_API_KEY` - optional API key fallback for Google Speech client
- `OPENAI_API_KEY` - OpenAI API key used for text generation and analysis
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret
- `UPLOAD_AUDIO_DIR` - audio upload directory
- `UPLOAD_REPORTS_DIR` - generated PDF directory
- `MAX_UPLOAD_SIZE_MB` - max upload size in MB

## Run

```bash
npm install
npm run dev
```

Speech-to-Text notes:

- Backend transcription uses Google Cloud Speech-to-Text via `@google-cloud/speech`.
- Audio is converted to LINEAR16, 16kHz WAV using `ffmpeg` before recognition.
- If Google Speech fails or credentials are missing, service falls back to demo transcript output.

AI generation notes:

- OpenAI is now the primary engine for SOAP note generation, patient brief generation, drug safety review, and follow-up extraction.
- OpenAI is now the primary AI generation engine for SOAP notes, patient briefs, drug safety review, and follow-up extraction.

Health check:

```bash
curl http://localhost:5000/health
```

## Contract Compatibility

Implemented frontend-facing routes include:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/validate-token`
- `GET|POST|PUT /api/patients...`
- `GET|POST|DELETE /api/consultations...`
- `POST /api/consultations/:id/upload-audio`
- `GET|PATCH /api/consultations/transcriptions...`
- `POST /api/consultations/:id/report`
- `POST|PUT /api/consultations/:id/report/preview...`
- `GET|DELETE /api/reports...`
- `GET /api/dashboard/stats`
- `GET|PUT /api/user/profile`
- `POST /api/user/change-password`
- `GET|PUT /api/user/language`
- Subscription routes under `/api/...`
- Super-admin routes under `/api/super-admin/...`

## Node to Python Integration

Audio processing path:

1. Frontend uploads audio to Node endpoint.
2. Node stores file metadata in Mongo.
3. Node sends multipart audio to FastAPI `POST /transcribe`.
4. Node stores transcription/analysis response.
5. Node serves data and report generation endpoints to frontend.
