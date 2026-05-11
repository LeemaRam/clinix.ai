# Clinix.ai

Clinix.ai is a hybrid medical transcription platform that turns consultation audio into structured clinical output. It combines a React dashboard, a Node.js orchestration API, and a FastAPI AI service so clinicians can manage patients, consultations, reports, follow-ups, appointments, and subscriptions in one place.

## What the platform does

Clinix.ai is built to help medical teams move from audio capture to actionable records faster.

- Transcribes consultation audio into speaker-aware dialogue segments.
- Generates SOAP notes, patient briefs, drug safety checks, and follow-up summaries.
- Stores patient, consultation, appointment, and report data in MongoDB.
- Supports real-time updates through Socket.IO.
- Provides role-based access for doctors, admins, and super admins.
- Includes a modern frontend for reviewing consultations, reports, analytics, and subscriptions.

## Architecture

The repository is organized as a three-service application:

- `frontend/` - React 18 + Vite + TypeScript UI.
- `backend-node/` - Express API for authentication, persistence, uploads, dashboards, and orchestration.
- `ai-service/` - FastAPI service for transcription and AI-assisted clinical workflows.
- `backend-legacy/` - Deprecated Flask backend kept only for reference.

Request flow:

`Frontend -> Node API -> FastAPI AI Service -> AI provider -> Node API -> Frontend`

## Key features

### Frontend

- Clinician dashboard with patient and consultation management.
- Registration and login flows.
- Past consultations view with speaker-colored transcription segments.
- Pages for reports, analytics, appointments, follow-ups, pricing, and settings.
- Super admin pages for user, language, and subscription-plan management.

### Backend API

- JWT-based authentication.
- Patient, consultation, report, appointment, and follow-up APIs.
- File upload handling for consultation audio.
- Socket.IO support for live updates.
- PDF generation and subscription support.

### AI service

- Audio transcription endpoint.
- SOAP note generation.
- Drug safety and interaction analysis.
- Patient brief generation.
- Follow-up extraction and reminder helpers.

## Tech stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Axios
- Zustand
- React Hook Form
- React Toastify
- i18next
- Socket.IO client

### Backend

- Node.js
- Express
- MongoDB + Mongoose
- Socket.IO
- JWT
- Multer
- PDFKit
- Stripe
- Twilio
- `mongodb-memory-server` for local fallback storage

### AI service

- FastAPI
- Uvicorn
- Pydantic
- python-multipart
- OpenAI / Gemini integration
- Audio and clinical helper workflows

## Repository layout

```text
clinix.ai/
  backend-node/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
      utils/
    .env.example
    package.json
  ai-service/
    app/
      main.py
      schemas.py
      services/
    .env.example
    requirements.txt
  frontend/
    src/
      components/
      context/
      i18n/
      pages/
      services/
      utils/
    package.json
  backend-legacy/
  docker-compose.yml
```

## Prerequisites

Install the following before running the project locally:

- Node.js 18+ and npm
- Python 3.10+ with pip
- MongoDB Atlas or local MongoDB
- FFmpeg for audio handling
- OpenAI API key if you want live transcription
- Gemini API key if you want live AI-generated clinical summaries

## Environment setup

Never commit real secrets to the repository. Use local `.env` files instead.

### `backend-node/.env`

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/clinix_ai
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
DEMO_MODE=false
PYTHON_AI_SERVICE_URL=http://localhost:8001
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
MAX_UPLOAD_SIZE_MB=1024
```

### `ai-service/.env`

```env
AI_SERVICE_PORT=8001
GEMINI_API_KEY=replace-with-your-gemini-key
DEMO_MODE=true
MAX_FILE_MB=1024
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/LeemaRam/clinix.ai.git
cd clinix.ai
```

### 2. Install the backend

```bash
cd backend-node
npm install
```

### 3. Install the AI service dependencies

```bash
cd ../ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Install the frontend

```bash
cd ../frontend
npm install
```

## Running locally

Run each service in its own terminal.

### Terminal 1: backend API

```bash
cd backend-node
npm run dev
```

Default port: `http://localhost:5000`

### Terminal 2: AI service

```bash
cd ai-service
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Default port: `http://localhost:8001`

### Terminal 3: frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Default port: `http://localhost:3000`

## Local data persistence

The backend first tries to connect to the configured MongoDB URI. If that fails during local development, it falls back to a local MongoDB-compatible store in `backend-node/.mongo-data` so newly created users and other records can persist across restarts.

## Main routes

### Frontend routes

- `/` - dashboard
- `/login` and `/register` - authentication
- `/patients` - patient list
- `/patients/:id` - patient details
- `/patients/:id/edit` - patient edit
- `/new-consultation` - new consultation flow
- `/past-consultations` - transcription history
- `/reports` - reports
- `/analytics` - analytics dashboard
- `/appointments` - appointments
- `/follow-ups` - follow-up management
- `/pricing` - subscription pricing
- `/super-admin/*` - super admin views

### Backend API highlights

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/patients`
- `POST /api/consultations`
- `GET /api/reports`
- `GET /api/dashboard/stats`
- `GET /api/appointments`
- `GET /api/followups`

### AI service endpoints

- `GET /health`
- `POST /transcribe`
- `POST /generate-report`
- `POST /drug-safety`
- `POST /drug-check`
- `POST /patient-brief`
- `POST /soap-note`
- `POST /extract-followup`
- `POST /send-reminder`

## Notes for contributors

- Keep secrets in local `.env` files only.
- Do not commit generated database data, uploads, or build artifacts.
- The legacy Flask backend is preserved for reference, but the active application uses the Node.js + FastAPI stack.

## Deployment

A root `docker-compose.yml` is included for local multi-service development. The services can also be containerized independently for cloud deployment.

## License

No license file is currently included in this repository.
