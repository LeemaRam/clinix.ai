# Clinix AI

Clinix AI is a full-stack medical consultation documentation platform that helps clinicians manage patients, record or upload consultation audio, transcribe conversations, and generate structured medical reports.

## Description

Clinix AI exists to reduce documentation overhead for healthcare professionals by turning consultation audio into actionable clinical records. It combines transcription, AI-assisted report generation, and patient/consultation management in one application.

### What It Does

- Authenticates users with role-based access (doctor, admin, super admin)
- Manages patients and consultations
- Uploads and validates large audio files (up to 1 GB per upload)
- Transcribes consultation audio (including chunked processing for large files)
- Generates AI-assisted medical reports and downloadable PDF outputs
- Supports editable report previews before final PDF generation
- Provides subscription plan management with Stripe checkout and webhooks
- Offers super-admin tooling for user and subscription administration
- Includes multilingual UI support

### Why It Exists

Clinical documentation is time-consuming and repetitive. Clinix AI streamlines this workflow by combining recording/transcription and report generation into a single system, helping clinicians focus more on care and less on paperwork.

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- React Toastify
- i18next and react-i18next
- Zustand

### Backend

- Python 3
- Flask
- Flask CORS
- Flask JWT Extended
- Flask SocketIO
- MongoDB with PyMongo
- OpenAI API (Whisper + chat completions)
- ReportLab (PDF generation)
- Stripe API
- Audio processing: pydub, librosa, soundfile, ffmpeg-python

## Installation

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- MongoDB running locally or remotely
- FFmpeg installed and available in PATH
- OpenAI API key
- Stripe account and API keys

## 1) Clone Repository

~~~bash
git clone https://github.com/LeemaRam/clinix.ai.git
cd clinix.ai
~~~

## 2) Backend Setup

~~~bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
~~~

Create a backend environment file at backend/.env:

~~~env
SECRET_KEY=change-me
JWT_SECRET_KEY=change-me-too
MONGODB_URI=mongodb://localhost:27017/clinix_ai
OPENAI_API_KEY=your-openai-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
~~~

Optional seed scripts:

~~~bash
python seed_super_admin.py
python seed_subscription_plans.py
~~~

## 3) Frontend Setup

Open another terminal:

~~~bash
cd frontend
npm install
~~~

Create frontend/.env:

~~~env
VITE_API_URL=http://localhost:5000
~~~

## Usage

## Run Backend

~~~bash
cd backend
source .venv/bin/activate
python app.py
~~~

Backend runs on: http://localhost:5000

## Run Frontend

~~~bash
cd frontend
npm run dev
~~~

Frontend runs on: http://localhost:3000

## Typical Flow

1. Register or log in.
2. Create or select a patient.
3. Create a consultation.
4. Record audio in browser or upload an audio file.
5. Wait for transcription completion.
6. Generate report preview, edit if needed, then create final PDF.
7. Review reports and dashboard metrics.

## Default Seeded Admin (if seed_super_admin.py is used)

- Email: admin@email.com
- Password: admin
- Role: super_admin

## Project Structure

~~~text
clinix.ai/
  backend/
    app.py                       # Main Flask API and SocketIO server
    stt.py                       # OpenAI transcription helper
    seed_super_admin.py          # Creates default super admin user
    seed_subscription_plans.py   # Seeds Stripe-backed subscription plans
    requirements.txt             # Python dependencies
  frontend/
    src/
      App.tsx                    # Route map and application shell
      context/AuthContext.tsx    # Auth state and token validation
      pages/                     # Screens for dashboard, patients, reports, etc.
      components/                # Reusable UI and feature components
      services/subscriptionService.ts  # Subscription API integration
      i18n/                      # Internationalization setup and locales
    package.json                 # Frontend scripts and dependencies
~~~

## API Documentation

Base URL: http://localhost:5000

Authentication uses Bearer JWT for protected routes.

## Health

- GET /health

Response example:

~~~json
{
  "status": "OK",
  "message": "Clinix.ai API is running",
  "version": "2.0.0"
}
~~~

## Auth

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/auth/validate-token

Login request example:

~~~json
{
  "email": "doctor@example.com",
  "password": "strong-password"
}
~~~

## User Settings

- GET /api/user/profile
- PUT /api/user/profile
- POST /api/user/change-password
- GET /api/user/language
- PUT /api/user/language

## Patients

- GET /api/patients
- POST /api/patients
- GET /api/patients/:patient_id
- PUT /api/patients/:patient_id

Create patient request example:

~~~json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "date_of_birth": "1988-04-20T00:00:00Z",
  "gender": "female"
}
~~~

## Consultations and Audio

- GET /api/consultations
- POST /api/consultations
- PUT /api/consultations/:consultation_id
- DELETE /api/consultations/:consultation_id
- POST /api/consultations/:consultation_id/start
- POST /api/consultations/:consultation_id/end
- POST /api/consultations/:consultation_id/validate-upload
- POST /api/consultations/:consultation_id/upload-audio
- GET /api/upload/limits

## Transcriptions

- GET /api/consultations/transcriptions/:consultation_id
- GET /api/consultations/transcriptions/:consultation_id/status
- PATCH /api/consultations/transcriptions/:consultation_id/segments/:segment_id

## Reports

- POST /api/consultations/:consultation_id/report
- POST /api/consultations/:consultation_id/report/preview
- PUT /api/consultations/:consultation_id/report/preview/:preview_id
- POST /api/consultations/:consultation_id/report/preview/:preview_id/generate
- GET /api/reports
- GET /api/reports/:report_id
- GET /api/reports/:report_id/download

## Subscription and Billing

- GET /api/subscription/plans
- GET /api/subscription/plans/:plan_id
- POST /api/subscription/plans/compare
- GET /api/subscription/current
- POST /api/subscription/create-checkout-session
- POST /api/subscription/cancel
- POST /api/webhook/stripe

## Super Admin

- GET /api/super-admin/stats
- CRUD /api/super-admin/users
- CRUD /api/super-admin/languages
- CRUD /api/super-admin/subscription-plans
- PATCH /api/super-admin/subscription-plans/:plan_id/toggle-status
- POST /api/super-admin/subscription-plans/:plan_id/duplicate
- GET /api/super-admin/subscription-plans/analytics
- GET /api/super-admin/subscription-plans/export
- POST /api/super-admin/subscription-plans/bulk-actions

## WebSocket Events

SocketIO events observed in backend:

- connect
- disconnect
- join_room
- get_transcription_progress

Server also emits transcription/consultation status events during processing.

## Environment Variables

## Backend (backend/.env)

- SECRET_KEY: Flask session secret key
- JWT_SECRET_KEY: JWT signing key
- MONGODB_URI: MongoDB connection URI
- OPENAI_API_KEY: OpenAI API key for transcription and report generation
- STRIPE_SECRET_KEY: Stripe secret key for checkout/subscriptions
- STRIPE_WEBHOOK_SECRET: Stripe webhook signing secret

## Frontend (frontend/.env)

- VITE_API_URL: Backend API base URL used by Axios calls

## Features

- Role-based authentication and authorization
- Patient records and consultation lifecycle management
- Browser recording or manual audio upload
- Audio validation and large-file chunking support
- AI-powered transcription and medical report generation
- Editable report preview workflow
- PDF report export and report history
- Dashboard statistics for clinicians
- Subscription plans with Stripe checkout integration
- Super-admin panel for users, languages, and plans
- Internationalization support

## Future Improvements

- Add automated tests (backend and frontend)
- Split backend monolith app.py into modular blueprints/services
- Add Docker and docker-compose for one-command local setup
- Improve API versioning and OpenAPI documentation
- Harden security defaults (rate limits, stricter CORS, secret management)
- Add async task queue for transcription/report jobs (for example, Celery + Redis)
- Add observability (structured logs, tracing, metrics)
- Resolve frontend/backend endpoint mismatches in subscription and language modules

## Assumptions and Notes

- Repository currently has no root .env.example files; environment variables above are inferred from code usage.
- Some frontend service calls reference endpoints that are not present in backend/app.py (for example, verify-subscription and some language/subscription variants). The documented API list reflects currently implemented backend routes.
- Backend branding strings include Clinix.ai in API responses, while repository name is Clinix AI.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make focused, well-tested changes.
4. Open a pull request with a clear description and screenshots or logs where relevant.

Recommended contribution standards:

- Follow existing code style in both frontend and backend.
- Keep commits atomic and descriptive.
- Add or update tests for behavior changes.
- Update documentation when APIs or workflows change.

## License

This project is licensed under the MIT License.
