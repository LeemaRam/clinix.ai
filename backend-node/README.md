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
- `CORS_ORIGIN` - allowed origins (comma-separated)
- `PYTHON_AI_SERVICE_URL` - FastAPI service URL
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
