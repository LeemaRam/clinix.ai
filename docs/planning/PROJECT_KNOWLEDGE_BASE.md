# PROJECT_KNOWLEDGE_BASE

## 1. Executive Summary

Clinix.ai is a multi-service medical consultation documentation platform. Its core goal is to help a doctor capture consultation audio, transcribe it, derive structured clinical insights, generate SOAP-style reports, manage patients, and coordinate follow-up/appointment communication.

Main user roles:
- Doctor: primary operational user for patients, consultations, transcriptions, reports, analytics, follow-ups, and subscriptions.
- Super admin: administrative user for user management, language settings, subscription plans, and system-level metrics.
- Patient/public user: limited public interaction through appointment booking and WhatsApp-based appointment confirmation.

Main business/clinical workflow:
1. Doctor registers or logs in.
2. Doctor creates or selects a patient.
3. Doctor opens a new consultation.
4. Audio is recorded in-browser or uploaded.
5. Backend stores the audio and starts an AI task pipeline.
6. AI service transcribes audio and backend/OpenAI logic derives medical analysis and a SOAP note.
7. Frontend previews and saves or exports a report PDF.
8. System can create follow-up/appointment records and send WhatsApp invitations/reminders.
9. Subscription and super-admin workflows exist around plan management and billing.

Current local run status detectable from the open terminals:
- Frontend reachable: http://localhost:3000
- Backend health reachable: http://localhost:5000/health
- AI service health reachable: http://localhost:8001/health
- The local stack appears healthy at the time of inspection.

High-level architecture summary:
- frontend/: React + TypeScript + Vite UI.
- backend-node/: main Express + MongoDB API and orchestration layer.
- ai-service/: FastAPI service for transcription and AI-heavy processing.
- backend-legacy/: deprecated Flask monolith retained as reference.
- MongoDB is the active persistence layer inferred from backend-node.
- External integrations include OpenAI, Twilio WhatsApp, Stripe, Google Speech fallback, and RxNorm.

## 2. Project Structure

Filtered tree excluding node_modules, .venv, uploads, dist/build, cache, and generated folders:

```text
D:\clinixai-stage
├── .gitignore
├── ApiError.js
├── docker-compose.yml
├── README.md
├── start-local.ps1
├── temp_diff.txt
├── ai-service
│   ├── .dockerignore
│   ├── .env.example
│   ├── Dockerfile
│   ├── README.md
│   ├── requirements.txt
│   ├── test_transcribe.py
│   ├── transcribe_test.py
│   ├── tts.ps1
│   └── app
│       ├── main.py
│       ├── schemas.py
│       └── services
│           ├── ai_service.py
│           ├── drug_safety_service.py
│           ├── followup_service.py
│           ├── patient_brief_service.py
│           └── soap_note_service.py
├── backend-legacy
│   ├── app.py
│   ├── README.md
│   ├── requirements.txt
│   ├── seed_subscription_plans.py
│   ├── seed_super_admin.py
│   ├── stt.py
│   └── test_openai.py
├── backend-node
│   ├── .dockerignore
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── README.md
│   ├── seed-stripe-plans.js
│   └── src
│       ├── app.js
│       ├── server.js
│       ├── socket.js
│       ├── config
│       │   ├── db.js
│       │   └── env.js
│       ├── controllers
│       ├── middleware
│       ├── models
│       ├── routes
│       ├── services
│       └── utils
└── frontend
    ├── .dockerignore
    ├── .env.example
    ├── Dockerfile
    ├── eslint.config.js
    ├── index.html
    ├── nginx.conf
    ├── package.json
    ├── package-lock.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── tsconfig*.json
    ├── vite.config.ts
    └── src
        ├── App.tsx
        ├── main.tsx
        ├── index.css
        ├── components
        ├── context
        ├── hooks
        ├── i18n
        ├── locales
        ├── pages
        ├── services
        ├── types
        └── utils
```

Important folder/file purposes:
- README.md: root architecture, local run instructions, and deployment notes.
- docker-compose.yml: local multi-container composition for frontend, backend, and ai-service.
- start-local.ps1: Windows PowerShell helper that verifies env files, venv presence, ports, FFmpeg, and starts all three services as background jobs.
- ai-service/app/main.py: FastAPI entry point and route registration.
- ai-service/app/services/*: transcription, OpenAI prompting, drug safety, SOAP note, patient brief, follow-up helpers.
- backend-node/src/app.js: Express app assembly, middleware, route mounting, health endpoints.
- backend-node/src/server.js: HTTP server, DB connection, Socket.IO server, upload dir creation, super-admin bootstrap.
- backend-node/src/controllers/*: business handlers per route module.
- backend-node/src/services/*: orchestration, external service calls, AI task workflow, Twilio, analytics.
- backend-node/src/models/*: Mongoose schemas.
- frontend/src/App.tsx: React route map and role-based shell composition.
- frontend/src/context/AuthContext.tsx: login/register/token lifecycle.
- frontend/src/services/*: frontend API client layer.
- frontend/src/pages/*: user and super-admin screens.
- backend-legacy/: old Flask implementation; appears deprecated and not wired into the current active stack.
- ApiError.js at root: appears stray or duplicated utility outside the active backend-node source tree.
- temp_diff.txt: temporary artifact, candidate for cleanup review.

## 3. Active Services

| Service | Folder | Framework / Language | Main entry | Port | Start command | Required dependencies | Required env vars | Health check |
|---|---|---|---|---|---|---|---|---|
| Frontend | frontend | React 18, TypeScript, Vite | src/main.tsx -> src/App.tsx | 3000 dev / 80 in Docker | npm run dev | Node.js, npm | VITE_API_URL | http://localhost:3000 |
| Backend API | backend-node | Node.js, Express, Mongoose, Socket.IO | src/server.js | 5000 | npm run dev | Node.js, npm, MongoDB | MONGODB_URI, JWT_SECRET, PORT, PYTHON_AI_SERVICE_URL; several optional integration vars | http://localhost:5000/health |
| AI Service | ai-service | Python 3.11/3.13, FastAPI, OpenAI | app/main.py | 8001 | python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload | Python 3.11 or 3.13, pip, FFmpeg/ffprobe | OPENAI_API_KEY, AI_SERVICE_PORT; optional others | http://localhost:8001/health |
| Legacy backend | backend-legacy | Flask, PyMongo, Flask-SocketIO | app.py | 5000 if started | python app.py | Python, pip, MongoDB | Flask/JWT/OpenAI/Stripe env vars | none clearly formalized |

Notes:
- backend-legacy conflicts with backend-node on port 5000 and should be treated as inactive reference.
- start-local.ps1 starts frontend, backend-node, and ai-service only.
- docker-compose.yml defines ai-service, backend, and frontend; no legacy backend container is defined.

## 4. Local Setup and Run Guide

Prerequisites:
- MongoDB running locally or reachable via MONGODB_URI.
- Node.js and npm installed.
- Python 3.11 recommended for ai-service.
- FFmpeg and ffprobe installed and available on PATH.
- OpenAI API key available for backend-node and ai-service.

Recommended manual startup order:
1. AI service
2. Backend API
3. Frontend

PowerShell setup commands:

### Option A: use the root helper script

```powershell
Set-Location D:\clinixai-stage
.\start-local.ps1
```

What start-local.ps1 expects:
- ai-service\.venv\Scripts\python.exe must exist.
- .env files are copied from .env.example when missing.
- Ports 8001, 5000, and 3000 must be free.
- FFmpeg/ffprobe should be detectable.

### Option B: run services manually

#### MongoDB
```powershell
# Use your local MongoDB service or MongoDB Compass/Atlas connection.
# Default local URI expected by backend-node:
# mongodb://localhost:27017/clinix_ai
```

#### AI service setup and startup
```powershell
Set-Location D:\clinixai-stage\ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

#### Backend startup
```powershell
Set-Location D:\clinixai-stage\backend-node
npm install
npm run dev
```

#### Frontend startup
```powershell
Set-Location D:\clinixai-stage\frontend
npm install
npm run dev
```

Expected localhost URLs:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Backend health: http://localhost:5000/health
- AI service: http://localhost:8001
- AI service health: http://localhost:8001/health

FFmpeg requirement:
- Required by ai-service for audio decoding.
- start-local.ps1 attempts to auto-detect FFmpeg in common Windows paths.

## 5. Environment Variables

Important safety note:
- Actual .env files are present in the working tree locally.
- Sensitive values must be treated as compromised if this repo has ever been shared.
- All secret values below are intentionally redacted.

### Frontend env variables

| Variable | Required | Purpose | Safe local example | Notes |
|---|---|---|---|---|
| VITE_API_URL | Yes | Frontend base URL for backend API/proxy target | http://localhost:5000 | Used in frontend/.env.example and vite.config.ts |

### Backend-node env variables

| Variable | Required | Purpose | Safe local example | Notes |
|---|---|---|---|---|
| PORT | Yes | API listen port | 5000 | Defaults to 5000 |
| NODE_ENV | Yes | Runtime mode | development | Affects CORS and rate limits |
| MONGODB_URI | Yes | MongoDB connection string | mongodb://localhost:27017/clinix_ai | Primary DB variable |
| JWT_SECRET | Yes | JWT signing secret | REDACTED | Primary auth secret |
| JWT_EXPIRES_IN | Optional | Token TTL | 7d | Default in code |
| CORS_ORIGIN | Yes in prod | Allowed frontend origins | http://localhost:3000 | Comma-separated in prod |
| FRONTEND_URL | Yes in prod | Frontend URL for Socket.IO/CORS references | http://localhost:3000 | Used by server.js |
| PYTHON_AI_SERVICE_URL | Yes | Backend -> AI service base URL | http://localhost:8001 | Primary AI service URL |
| OPENAI_API_KEY | Optional but effectively required for AI features | OpenAI API access | REDACTED | Used in backend OpenAI services and Whisper fallback |
| OPENAI_MODEL | Optional | Default OpenAI responses model | gpt-4.1-mini | Backend prompt model |
| OPENAI_WHISPER_MODEL | Optional | Whisper fallback model name | whisper-1 | Used when FastAPI transcription fails |
| OPENAI_API_BASE_URL | Optional | Alternate OpenAI base URL | https://api.openai.com/v1 | Leave default unless proxying |
| GOOGLE_APPLICATION_CREDENTIALS | Optional | Google Speech service account path | .\secrets\google-speech.json | Used as transcription fallback |
| GOOGLE_CLOUD_API_KEY | Optional | Alternative Google credential | REDACTED | Fallback helper |
| STRIPE_SECRET_KEY | Optional | Stripe server-side secret | REDACTED | Needed for checkout/webhooks |
| STRIPE_WEBHOOK_SECRET | Optional | Stripe webhook signature secret | REDACTED | Needed for webhook verification |
| STRIPE_SUCCESS_URL | Optional | Post-checkout success redirect | http://localhost:3000/subscription/success | Used in checkout session |
| STRIPE_CANCEL_URL | Optional | Post-checkout cancel redirect | http://localhost:3000/subscription/cancel | Used in checkout session |
| UPLOAD_AUDIO_DIR | Optional | Audio upload directory | uploads/audio | Created on startup |
| UPLOAD_REPORTS_DIR | Optional | PDF report directory | uploads/reports | Created on startup |
| MAX_UPLOAD_SIZE_MB | Optional | Upload size limit | 50 | Applies to audio upload middleware |
| OPENFDA_API_KEY | Optional | External drug data key | REDACTED | Present in env config; not strongly wired |
| RXNORM_API_ID | Optional | RxNorm API key/id | REDACTED | Used for RxNorm lookup |
| TWILIO_ACCOUNT_SID | Optional | Twilio account identifier | REDACTED | Used for WhatsApp integration |
| TWILIO_AUTH_TOKEN | Optional | Twilio auth token | REDACTED | Sensitive secret |
| TWILIO_WHATSAPP_NUMBER | Optional | Twilio WhatsApp sender | whatsapp:+14155238886 | Backend sender address |
| DEMO_MODE | Optional | Demo/fallback behavior toggle | false | Changes transcription behavior |
| REMINDER_RUN_SECRET | Optional but recommended | Secret for reminder runner endpoint | REDACTED | If empty, endpoint protection is weak |
| SUPER_ADMIN_EMAIL | Optional | Bootstrap super-admin email | admin@example.com | Used on startup |
| SUPER_ADMIN_PASSWORD | Optional | Bootstrap super-admin password | REDACTED | Used on startup |
| SUPER_ADMIN_FULL_NAME | Optional | Bootstrap super-admin name | Super Admin | Used on startup |
| SUPER_ADMIN_STORAGE_LIMIT_GB | Optional | Super-admin dashboard storage cap | 500 | Read directly in controller |

### AI service env variables

| Variable | Required | Purpose | Safe local example | Notes |
|---|---|---|---|---|
| AI_SERVICE_PORT | Yes | FastAPI port | 8001 | In .env.example |
| AI_SERVICE_HOST | Optional | FastAPI host | 0.0.0.0 | In .env.example |
| OPENAI_API_KEY | Yes in current code | OpenAI transcription and prompting | REDACTED | main.py startup hard-fails without it |
| OPENAI_MODEL | Optional | OpenAI text model | gpt-4o-mini | Used in .env.example; ai_service.py hardcodes gpt-4.1-mini in helper calls |
| RXNORM_API_ID | Optional | RxNorm normalization | REDACTED | Used in drug_safety_service.py |
| MAX_FILE_MB | Optional | Intended max upload size | 50 | Not strongly enforced in main.py |
| NODE_ENV | Optional | Runtime mode marker | production or development | Present in example, lightly used |
| DEMO_MODE | Optional | Demo mode toggle | false | health exposes it; startup still requires OPENAI_API_KEY |
| TWILIO_ACCOUNT_SID | Optional | Twilio account SID | REDACTED | Used by followup_service.py |
| TWILIO_AUTH_TOKEN | Optional | Twilio auth token | REDACTED | Used by followup_service.py |
| TWILIO_WHATSAPP_FROM | Optional | WhatsApp sender | whatsapp:+14155238886 | Used in followup_service.py but missing from .env.example |

Special env focus:
- MongoDB URI variable: MONGODB_URI
- JWT secret variable: JWT_SECRET
- AI service URL variable: PYTHON_AI_SERVICE_URL
- Frontend API URL variable: VITE_API_URL
- OpenAI key variable: OPENAI_API_KEY
- Twilio variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER, TWILIO_WHATSAPP_FROM
- Stripe variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL
- Google OAuth/Calendar vars: not found
- Google Speech vars: GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_API_KEY

## 6. Backend Architecture

### Main app/server entry points
- src/app.js builds the Express app, security middleware, body parsers, rate limits, health endpoints, and route registration.
- src/server.js loads env, connects MongoDB, creates upload directories, bootstraps optional super-admin account, starts HTTP + Socket.IO, validates Twilio config, and resumes pending AI tasks.

### Middleware
- auth.js: JWT auth, role normalization, super-admin guards.
- upload.js: Multer disk storage for audio uploads with MIME allowlist and size cap.
- errorHandler.js: normalizes Mongoose and generic errors into JSON responses.
- notFound.js: catch-all 404 JSON.

### Route registration
Mounted in src/app.js:
- /api/auth
- /api/patients
- /api/consultations
- /api/reports
- /api/dashboard
- /api/user
- /api (subscription routes)
- /api/super-admin
- /api/ai
- /api/agents
- /api/followups
- /api/appointments
- /api/reminders
- /api/webhooks
- /api/patients (patient files)
- /api/test

### Controllers and services
Controller modules follow route groups. Heavy logic is split into services:
- pythonService.js: backend -> FastAPI calls, transcription dispatch, drug safety, SOAP API calls.
- aiTaskService.js: queued AI workflow orchestration and persistence.
- aiWorkflowService.js: workflow stages and individual worker functions.
- openaiService.js: backend-side OpenAI prompting for analysis, SOAP, patient brief, follow-up extraction.
- twilioService.js and followupInvitationService.js: WhatsApp sending/invitation formatting.
- followupReminderWorker.js: reminder scanning/sending worker.
- patientFileAnalysisService.js: lightweight PDF/text/image patient file summarization.
- analyticsService.js: persists workflow metrics into consultation metadata.

### Models
Core persisted entities:
- User
- Patient
- Consultation
- Transcription
- Report
- AiTask
- Appointment
- FollowUp
- SubscriptionPlan
- UserSubscription

### Auth flow
- Public registration and login issue JWTs.
- protect middleware verifies Bearer token, fetches User, normalizes role, blocks inactive users.
- Frontend stores access_token in localStorage and validates via /api/auth/validate-token.

### Role system
- Supported roles in active backend: doctor, super_admin.
- Public registration forbids creating super_admin.
- Super-admin routes enforce authorize('super_admin').
- Frontend redirects super_admin to /super-admin.

### File upload flow
- Audio uploads: /api/consultations/:id/upload-audio via Multer disk storage to uploads/audio.
- Patient files: /api/patients/:patientId/files via separate Multer storage to uploads/patient_files.
- Upload dirs are created automatically.

### Consultation flow
1. Doctor creates consultation record.
2. Doctor uploads/records audio.
3. Backend stores audio and creates/updates Transcription record.
4. Backend creates AiTask and emits Socket.IO progress.
5. aiTaskService executes transcription -> medical analysis -> SOAP generation -> clinical context -> follow-up -> analytics.
6. Consultation status updates to transcribed or failed.

### Report generation flow
- Preview data is derived from Consultation + Transcription + AiTask result.
- saveReportPreview persists a Report document and attempts appointment synchronization.
- generateConsultationReportPdf and generateConsultationReportPreviewPdf render PDFs with PDFKit and stream them back to the client.
- Generated PDFs are also persisted as Report records with filePath.

### Twilio / WhatsApp flow
- Appointment or follow-up invitations are sent from backend-node using Twilio.
- Twilio webhook replies are parsed for confirm/decline actions and can create FollowUp documents from pending Appointment records.
- Reminder worker scans upcoming confirmed follow-ups and sends day-before/day-of/during reminders.

### Stripe / subscription flow
- Public plans are read from SubscriptionPlan or fallback seed-like defaults.
- Authenticated users can create Stripe checkout sessions.
- Stripe webhook creates or updates UserSubscription records.
- Super-admin can manage plans.

### Socket.IO / realtime flow
- Socket.IO runs in backend-node server.js.
- Frontend can join consultation:{id} rooms.
- Backend emits transcription_progress, ai_task_status, appointment_created, appointment_confirmed, report_generation_started, report_generation_completed.

### Error handling structure
- Controllers mostly use asyncHandler wrapper.
- Middleware converts Mongoose cast/duplicate/validation errors into standard JSON.
- Some controllers still return ad hoc response shapes rather than a single consistent contract.

### Validation approach
- Validation is mostly manual in controllers and via Mongoose schema requirements.
- No formal schema validator like Zod/Joi/express-validator is used in active backend-node routes.

### Background jobs / queues
- No durable external queue is present.
- AiTask processing is background-in-process async work.
- Reminder scheduling uses in-memory timers and a manual reminder runner endpoint.
- This is operationally fragile across restarts.

## 7. Backend API Inventory

### authRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| POST | /api/auth/register | No | Public | registerUser | Register doctor | full_name, email, password, optional role | token + user | Public registration; blocks super_admin |
| POST | /api/auth/login | No | Public | loginUser | Login | email, password | token + user | Supports legacy plaintext password fallback |
| GET | /api/auth/validate-token | Yes | Any authenticated | validateToken | Validate token / session sync | none | user payload | Used by frontend boot |
| POST | /api/auth/logout | Yes | Any authenticated | logoutUser | Stateless logout | none | success message | Client-side token removal only |
| GET | /api/auth/profile | Yes | Any authenticated | inline handler | Return req.user | none | req.user | Duplicates /api/user/profile |

### patientRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/patients | Yes | Doctor / super_admin user context | listPatients | Paginated patient list | page, limit, search query | patients + totals | Scoped by doctorId |
| POST | /api/patients | Yes | Doctor | createPatient | Create patient | patient profile fields | patient | Manual validation only |
| GET | /api/patients/:id | Yes | Doctor | getPatient | Patient detail + consultations | none | patient with consultations | Consultation list limited to 50 |
| PUT | /api/patients/:id | Yes | Doctor | updatePatient | Update patient / append note | partial patient fields, optional note | patient | No schema-level request validation |

### patientFileRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| POST | /api/patients/:patientId/files | Yes | Doctor | uploadPatientFile | Upload patient file | multipart file | saved file metadata | No MIME allowlist in route-level Multer config |
| GET | /api/patients/:patientId/files | Yes | Doctor | listPatientFiles | List patient files | none | file list | |
| GET | /api/patients/:patientId/files/analyze | Yes | Doctor | analyzeUploadedPatientFiles | Summarize uploaded files | none | summaries | PDF/text/image only lightly handled |
| GET | /api/patients/:patientId/files/:fileId/download | Yes | Doctor | downloadPatientFile | Download patient file | none | blob/download | |
| DELETE | /api/patients/:patientId/files/:fileId | Yes | Doctor | deletePatientFile | Delete file metadata and disk file | none | deleted true | Uses sync unlink |

### consultationRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/consultations | Yes | Doctor | listConsultations | Paginated consultation list | page, limit | consultations + pagination | |
| POST | /api/consultations | Yes | Doctor | createConsultation | Create consultation | patient_id, consultation_type, recording_type, consent_obtained | consultation | |
| DELETE | /api/consultations/:id | Yes | Doctor | deleteConsultation | Delete consultation and related docs | none | success | Deletes reports/transcriptions |
| POST | /api/consultations/:consultationId/approve-soap | Yes | Doctor | approveSoapNote | Approve/reject SOAP | approved boolean | message | Function references axios without visible import in file section inspected |
| POST | /api/consultations/:id/upload-audio | Yes | Doctor | uploadAudio | Upload audio and start AI pipeline | multipart audio, speech_language | consultation + transcription + task | Main async pipeline trigger |
| GET | /api/consultations/transcriptions/:consultationId | Yes | Doctor | getTranscriptionByConsultation | Read transcription | none | transcription | |
| GET | /api/consultations/:consultationId/ai-task | Yes | Doctor | getAiTaskByConsultation | Read AI task state | none | task | Used for progress restore |
| PATCH | /api/consultations/transcriptions/:consultationId/segments/:segmentId | Yes | Doctor | patchTranscriptionSegment | Edit transcript segment | text | transcription | |
| POST | /api/consultations/:consultationId/report | Yes | Doctor | generateConsultationReportPdf | Generate PDF from consultation | optional generatedBy | PDF stream | Also creates Report record |
| POST | /api/consultations/:consultationId/report/preview | Yes | Doctor | generateReportPreview | Build structured preview | none | preview_id + structured_content | |
| PUT | /api/consultations/:consultationId/report/preview/:previewId | Yes | Doctor | updateReportPreview | Echo/update preview payload | structured_content | structured_content | Not persisted |
| POST | /api/consultations/:consultationId/report/preview/:previewId/save | Yes | Doctor | saveReportPreview | Persist preview as report | structured_content, generatedBy | report | Non-blocking appointment sync |
| POST | /api/consultations/:consultationId/report/preview/:previewId/generate | Yes | Doctor | generateConsultationReportPreviewPdf | Generate PDF from preview | structured_content optional | PDF stream | |

### reportRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/reports | Yes | Doctor | listReports | Paginated reports | page, limit | reports + pagination | |
| GET | /api/reports/:id | Yes | Doctor | getReport | Report detail | none | report | Adds download_url |
| GET | /api/reports/:id/download | Yes | Doctor | downloadReport | Download PDF | none | PDF stream | |
| DELETE | /api/reports/:id | Yes | Doctor | deleteReport | Delete report record/file | none | deleted true | Uses sync unlink |

### dashboardRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/dashboard/stats | Yes | Doctor | stats | Dashboard counts + recent consultations | none | totals + recent_patients | |
| GET | /api/dashboard/analytics | Yes | Doctor | analyticsOverview | Analytics summary | none | counts | |
| GET | /api/dashboard/trends | Yes | Doctor | consultationTrend | Consultation trend series | none | aggregated list | |
| GET | /api/dashboard/diagnoses | Yes | Doctor | topDiagnoses | Top diagnoses | none | aggregated list | Assumes unwind on assessment structure |

### userRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/user/profile | Yes | Any authenticated | getProfile | User profile | none | ApiResponse profile | |
| PUT | /api/user/profile | Yes | Any authenticated | updateProfile | Update profile | fullName, language | ApiResponse | |
| POST | /api/user/change-password | Yes | Any authenticated | changePassword | Change password | currentPassword, newPassword | ApiResponse | |
| GET | /api/user/language | Yes | Any authenticated | getLanguage | Get language | none | ApiResponse | |
| PUT | /api/user/language | Yes | Any authenticated | setLanguage | Set language | language | ApiResponse | |

### subscriptionRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/subscription/plans | No | Public | getPublicPlans | Public plan list | none | plans | Falls back to hardcoded plans if DB empty |
| GET | /api/subscription/plans/:id | No | Public | getPlan | Get plan detail | none | plan | |
| POST | /api/subscription/plans/compare | No | Public | comparePlans | Compare plans | plan_ids | plans | |
| GET | /api/user/subscription | Yes | User | getUserSubscription | Current subscription | none | subscription + plan + usage | |
| POST | /api/subscription/create-checkout-session | Yes | User | createCheckoutSession | Start Stripe checkout | planId, successUrl, cancelUrl | sessionId + url | Requires Stripe config |
| GET | /api/verify-subscription | Yes | User | verifySubscription | Placeholder verify | session_id query used by frontend | message | Not a full verification workflow |
| POST | /api/cancel-subscription | Yes | User | cancelSubscription | Mark cancelAtPeriodEnd | none | canceled true | Does not call Stripe API directly |
| POST | /api/reactivate-subscription | Yes | User | reactivateSubscription | Clear cancelAtPeriodEnd | none | reactivated true | Does not call Stripe API directly |
| POST | /api/stripe/webhook | No | Stripe | handleStripeWebhook | Stripe webhook receiver | raw JSON | received true | Signature verified if secret configured |

### superAdminRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/super-admin/stats | Yes | super_admin | getStats | System stats | none | totals/storage/status | |
| GET | /api/super-admin/users | Yes | super_admin | listUsers | List users | optional role query | users | |
| POST | /api/super-admin/users | Yes | super_admin | createUser | Create user | full_name, email, password, role | user | |
| PUT | /api/super-admin/users/:id | Yes | super_admin | updateUser | Update user | user fields | user | |
| DELETE | /api/super-admin/users/:id | Yes | super_admin | deleteUser | Delete user | none | success | Hard delete |
| PATCH | /api/super-admin/users/:id/toggle-status | Yes | super_admin | toggleUserStatus | Activate/deactivate user | none | is_active | |
| GET | /api/super-admin/languages | Yes | super_admin | getLanguages | Read in-memory language config | none | language state | Not persisted |
| PUT | /api/super-admin/languages/ui | Yes | super_admin | updateUiLanguages | Update UI languages | languages | success | In-memory only |
| PUT | /api/super-admin/languages/speech | Yes | super_admin | updateSpeechLanguages | Update speech languages | languages | success | In-memory only |
| PUT | /api/super-admin/languages/default | Yes | super_admin | updateDefaultLanguage | Update default language | defaultLanguage | success | In-memory only |
| GET | /api/super-admin/subscription-plans | Yes | super_admin | listPlans | Admin plan list | page, limit, search | plans | |
| GET | /api/super-admin/subscription-plans/:id | Yes | super_admin | getPlan | Admin plan detail | none | plan + fake statistics | Statistics mostly placeholder |
| POST | /api/super-admin/subscription-plans | Yes | super_admin | createPlan | Create plan | plan fields | plan | |
| PUT | /api/super-admin/subscription-plans/:id | Yes | super_admin | updatePlan | Update plan | plan fields | plan | |
| PATCH | /api/super-admin/subscription-plans/:id/toggle-status | Yes | super_admin | togglePlanStatus | Toggle plan active | none | plan | |
| DELETE | /api/super-admin/subscription-plans/:id | Yes | super_admin | deletePlan | Soft delete plan | none | success | Sets deleted=true |
| POST | /api/super-admin/subscription-plans/:id/duplicate | Yes | super_admin | duplicatePlan | Duplicate plan | optional name, interval | plan | |

### agentRoutes.js and aiRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| POST | /api/agents/drug-check | Yes | Doctor | checkDrugSafety | Backend-side drug safety check | new_drugs, existing_drugs, patient context | result | |
| GET | /api/agents/patient-brief/:patientId | Yes | Doctor | getPatientBrief | Generate patient brief | none | brief data | |
| POST | /api/agents/soap-note | Yes | Doctor | generateSOAPNote | Generate SOAP from transcription | patientId, transcription, consultationReason | SOAP result | |
| POST | /api/ai/drug-safety | No | Public | drugSafetyCheck | Direct drug safety endpoint | medications, patientInfo, patientFiles | result | Unauthenticated |

### followupRoutes.js, appointmentRoutes.js, reminderRoutes.js, twilioWebhookRoutes.js, testRoutes.js

| Method | Endpoint | Auth | Role | Controller | Purpose | Request body | Response | Notes/issues |
|---|---|---|---|---|---|---|---|---|
| GET | /api/followups | Yes | Doctor | listFollowUps | List follow-ups | none | follow-ups | No pagination |
| POST | /api/followups | Yes | Doctor | scheduleFollowUp | Create follow-up + send invite | consultationId, followUpDate, followUpReason, patientPhone | follow-up | |
| POST | /api/followups/:id/send | Yes | Doctor | sendReminder | Send manual reminder | none | success | |
| POST | /api/appointments | No | Public | bookAppointment | Public booking | patient_name, patient_phone, preferred_date, reason, doctor_id optional | appointment | Public endpoint |
| GET | /api/appointments | Yes | Doctor | listAppointments | List appointments | none | appointments | Includes unowned appointments |
| PATCH | /api/appointments/:id | Yes | Doctor | updateAppointment | Confirm/cancel appointment | status | appointment | |
| POST | /api/reminders/run | Secret optional | Operational | runFollowupReminders | Trigger reminder worker | x-reminder-secret or secret query | worker results | If secret unset, protection is weak |
| POST | /api/webhooks/twilio/whatsapp | No | Twilio | handleTwilioWhatsAppWebhook | Parse WhatsApp replies | Twilio form payload | TwiML empty response | No Twilio signature verification found |
| GET | /api/test/openai | No | Public | testOpenAI | OpenAI connectivity test | none | output | Debug route exposed |
| POST | /api/test/openai-soap | No | Public | testOpenAISoap | Test SOAP generation | transcript | output | Debug route exposed |

## 8. Database and Models

| Model | File | Main fields | Required fields | Relationships | Indexes / timestamps | Purpose |
|---|---|---|---|---|---|---|
| User | backend-node/src/models/User.js | email, passwordHash, fullName, role, isActive, language, phone, subscriptionPlanId, lastLogin | email, passwordHash, fullName | subscriptionPlanId -> SubscriptionPlan | email indexed, timestamps | Doctor and super-admin accounts |
| Patient | backend-node/src/models/Patient.js | names, DOB, gender, contacts, conditions, allergies, meds, vitalSigns, notes, uploadedFiles, briefHistory, doctorId, status, lastVisit | firstName, lastName, dateOfBirth, gender, doctorId | doctorId -> User | doctorId indexed, timestamps | Doctor-owned patient record |
| Consultation | backend-node/src/models/Consultation.js | patientId, doctorId, consultationType, recordingType, consent, status, timing, audio metadata, languageDetected, medicalInfo, consultationSummary, SOAP/drug statuses | patientId, doctorId, consultationType, recordingType | patientId -> Patient, doctorId -> User | patientId and doctorId indexed, timestamps | One clinical encounter |
| Transcription | backend-node/src/models/Transcription.js | consultationId, doctorId, audioFilePath, status, rawText, segments, confidence, duration, analysis, errorMessage | consultationId, doctorId, audioFilePath | consultationId -> Consultation, doctorId -> User | consultationId and doctorId indexed, timestamps | Transcript + extracted analysis |
| Report | backend-node/src/models/Report.js | consultationId, patientId, doctorId, content, format, options, status, filePath, generatedBy | consultationId, patientId, doctorId, content | consultationId -> Consultation, patientId -> Patient, doctorId -> User | consultationId and doctorId indexed, timestamps | Saved/generated report payload/PDF |
| AiTask | backend-node/src/models/AiTask.js | consultationId, patientId, doctorId, taskType, status, progress, currentStep, error, result, meta | consultationId, patientId, doctorId, taskType | links to consultation/patient/doctor | consultationId, patientId, doctorId indexed, timestamps | Background AI workflow state |
| FollowUp | backend-node/src/models/FollowUp.js | consultationId, patientId, doctorId, appointmentId, followUpDate, reason, phone, referenceCode, reminder state, status | consultationId, patientId, doctorId, followUpDate | consultationId, patientId, doctorId, appointmentId | referenceCode unique sparse indexed, timestamps | Follow-up schedule and reminder lifecycle |
| Appointment | backend-node/src/models/Appointment.js | consultationId, patientId, patientName, patientPhone, preferredDate, reason, doctorId, referenceCode, invitation state, followUpId, status | patientName, patientPhone, preferredDate | optional links to Consultation, Patient, User, FollowUp | referenceCode unique sparse, timestamps | Proposed/public-booked appointment |
| SubscriptionPlan | backend-node/src/models/SubscriptionPlan.js | name, description, stripePriceId, price, currency, interval, usage caps, features, active, popular, trialDays, deleted | name, interval | referenced by User and UserSubscription | timestamps | Subscription catalog |
| UserSubscription | backend-node/src/models/UserSubscription.js | userId, planId, stripe IDs, status, period bounds, cancelAtPeriodEnd, isManualSubscription | userId, planId | userId -> User, planId -> SubscriptionPlan | userId indexed, timestamps | User billing/subscription record |

Main relationships:
- User -> Patient: one doctor owns many patients via patient.doctorId.
- Patient -> Consultation: one patient has many consultations.
- Consultation -> Transcription: usually one transcription per consultation.
- Consultation -> Report: one consultation can produce multiple reports/previews/PDFs.
- Consultation -> Appointment / FollowUp: report save or Twilio confirmation can create downstream scheduling records.
- User -> UserSubscription -> SubscriptionPlan: billing state chain.

Index observations:
- Some critical operational query paths are not indexed, especially Appointment and FollowUp by doctorId/status/date.
- Report lacks a patientId index despite patient-linked reads.

## 9. Frontend Architecture

- Framework/build tool: React 18 + TypeScript + Vite.
- Routing: BrowserRouter in src/App.tsx with explicit route declarations.
- Layout: AppShell provides Sidebar + Header; UserLayout and AdminLayout are thin wrappers over AppShell.
- Auth state: AuthContext manages login/register/logout/token validation and stores access_token/user in localStorage.
- Protected routes: ProtectedRoute blocks unauthenticated routes; SuperAdminRoute blocks non-super-admin users.
- API layer: service modules under src/services use apiFetch, Axios, and auth header helpers. Some pages still bypass services and call axios directly.
- State management: mostly React state + context; Zustand is listed as dependency but not clearly central in the inspected files.
- Forms: mostly local component state; react-hook-form is installed but not prominent in the inspected main workflows.
- Reusable components: ReportPreviewModal, FileUploadPanel, consultation helpers, common layout/ui components.
- Report preview/export UI: ReportPreviewModal plus PDF generation actions in Dashboard, PatientDetail, and PastConsultations.
- Appointment/follow-up UI: Appointments.tsx, FollowUps.tsx, BookAppointment.tsx.
- Dashboard/analytics UI: Dashboard.tsx and Analytics.tsx use cards, charts, and consultation drill-downs.
- Styling: Tailwind CSS with custom classes from index.css.
- Internationalization: i18next with locale folders and LanguageSelector.
- Realtime: socket.io-client joins consultation rooms and listens for AI/report/appointment events.

Architectural note:
- There is significant duplication across Dashboard.tsx, PatientDetail.tsx, and PastConsultations.tsx for transcription viewing and PDF/report interactions.

## 10. Frontend Routes and Pages

| Route | Page/component | Auth | Role | Purpose | Backend APIs used |
|---|---|---|---|---|---|
| /login | pages/Login.tsx | No | Public | Login screen | POST /api/auth/login |
| /register | pages/Register.tsx | No | Public | Registration screen | POST /api/auth/register |
| / | pages/Dashboard.tsx | Yes | Doctor | Overview stats and recent consultations | GET /api/dashboard/stats, GET /api/consultations/transcriptions/:id, POST /api/consultations/:id/report |
| /patients | pages/Patients.tsx | Yes | Doctor | Patient list/create modal | GET /api/patients, POST /api/patients |
| /patients/:id | pages/PatientDetail.tsx | Yes | Doctor | Patient detail, files, reports, transcripts | GET /api/patients/:id, GET /api/consultations/transcriptions/:id, POST /api/consultations/:id/report, patient file APIs |
| /patients/:id/edit | pages/PatientEdit.tsx | Yes | Doctor | Edit patient | GET/PUT /api/patients/:id |
| /new-consultation | pages/NewConsultation.tsx | Yes | Doctor | Start new consultation | GET /api/patients, POST /api/patients, POST /api/consultations, POST /api/consultations/:id/upload-audio, GET /api/consultations/:id/ai-task |
| /new-consultation/:patientId | pages/NewConsultation.tsx | Yes | Doctor | Start consultation pre-bound to patient | Same as above |
| /reports | pages/Reports.tsx | Yes | Doctor | List/download/delete reports | GET /api/reports, GET /api/reports/:id/download, DELETE /api/reports/:id |
| /analytics | pages/Analytics.tsx | Yes | Doctor | Charts and analytics | GET /api/dashboard/analytics, /trends, /diagnoses |
| /follow-ups | pages/FollowUps.tsx | Yes | Doctor | Follow-up list and manual reminder sending | GET /api/followups, POST /api/followups/:id/send |
| /appointments | pages/Appointments.tsx | Yes | Doctor | Appointment list and status updates | GET /api/appointments, PATCH /api/appointments/:id |
| /book-appointment | pages/BookAppointment.tsx | No | Public | Public appointment booking | POST /api/appointments |
| /past-consultations | pages/PastConsultations.tsx | Yes | Doctor | Consultation history, transcript review, report preview/PDF | GET /api/consultations, GET /api/consultations/transcriptions/:id, PATCH transcript segment, preview/report APIs |
| /settings | pages/Settings.tsx | Yes | Doctor or super_admin | User settings | /api/user/profile, /api/user/language, /api/user/change-password |
| /pricing | pages/Pricing.tsx | Yes | Doctor | Subscription plan selection | GET /api/subscription/plans, POST /api/subscription/create-checkout-session |
| /subscription/success | pages/SubscriptionSuccess.tsx | No | Post-checkout | Stripe success page | GET /api/verify-subscription |
| /subscription/cancel | pages/SubscriptionCancel.tsx | No | Post-checkout | Checkout cancel page | none/signpost |
| /super-admin | pages/super-admin/SuperAdminDashboard.tsx | Yes | super_admin | Admin overview | GET /api/super-admin/stats |
| /super-admin/users | pages/super-admin/UserManagement.tsx | Yes | super_admin | User administration | super-admin user APIs |
| /super-admin/languages | pages/super-admin/LanguageSettings.tsx | Yes | super_admin | Language settings | super-admin language APIs |
| /super-admin/subscription-plans | pages/super-admin/SubscriptionPlansManagement.tsx | Yes | super_admin | Plan administration | super-admin plan APIs |

## 11. AI Service Architecture

- Entry point: ai-service/app/main.py.
- Framework: FastAPI with permissive CORSMiddleware.
- Startup validation:
  - Requires Python 3.11 or 3.13.
  - Checks FFmpeg/ffprobe on PATH.
  - Hard-fails if OPENAI_API_KEY is missing.
- Health endpoint exposes Python/platform/OpenAI/FFmpeg status.

Main endpoint groups:
- /transcribe: multipart audio upload to Whisper transcription.
- /generate-report: structured summary + recommendations.
- /drug-safety and /drug-check: OpenAI + RxNorm based safety/interactions.
- /patient-brief: patient context summarization.
- /soap-note: SOAP note generation.
- /extract-followup: follow-up extraction from SOAP output.
- /send-reminder: Twilio WhatsApp send helper.

Transcription flow:
1. FastAPI receives UploadFile and writes to a temporary file.
2. ai_service.transcribe_audio_file validates file and optionally converts unsupported formats to mp3.
3. OpenAI Whisper transcribes the audio.
4. extract_medical_analysis runs an OpenAI JSON prompt to derive structured medical sections.
5. Response returns language, raw_text, segments, confidence_score, duration, analysis.
6. Temporary file is deleted.

SOAP/report/drug/follow-up flows:
- generate_report uses OpenAI JSON prompt for summary and recommendations.
- generate_soap_note uses an OpenAI text prompt and patient profile context.
- generate_patient_brief builds a markdown summary from patient profile, consultations, reports, and file summaries.
- check_drug_safety uses OpenAI JSON prompt; check_interactions adds RxNorm normalization and risk-level logic.
- extract_followup_from_soap is currently a simple parser over follow_up_days and SOAP plan.

OpenAI usage:
- ai_service.py instantiates OpenAI directly and uses responses.create and audio.transcriptions.create.
- Most helper calls hardcode gpt-4.1-mini regardless of .env.example OPENAI_MODEL value.

FFmpeg/audio usage:
- pydub/AudioSegment is used to inspect and potentially convert uploaded audio.
- FFmpeg presence is mandatory at startup.

Pydantic schemas:
- Request/response models live in app/schemas.py.
- Schemas cover report, transcription response, drug safety, drug check, patient brief, SOAP note, follow-up extraction, and reminder send.

Error handling:
- Endpoints wrap service calls and convert failures to HTTPException(502) in several routes.
- Logging is done via print statements rather than structured logging.

Async/background processing:
- /transcribe is async only because of file upload reading; downstream AI calls are still synchronous from the request’s perspective.
- No background queue or task manager exists inside ai-service.

## 12. AI Service API Inventory

| Method | Endpoint | Purpose | Request format | Response format | Backend caller | Required env vars | Notes/issues |
|---|---|---|---|---|---|---|---|
| GET | /health | Health and dependency diagnostics | none | JSON status object | human/backend ops | none | Exposes operational details |
| GET | / | Basic root status | none | JSON | optional | none | docs field points to /health, not /docs |
| POST | /transcribe | Transcribe consultation audio and derive medical analysis | multipart: file, speech_language, consultation_id | TranscribeResponse JSON | backend-node pythonService.transcribeAudio | OPENAI_API_KEY, FFmpeg on PATH | Reads full upload into memory before temp write |
| POST | /generate-report | Generate report summary/recommendations | JSON GenerateReportRequest | GenerateReportResponse | backend-node generateReport helper if used | OPENAI_API_KEY | |
| POST | /drug-safety | Drug safety analysis | JSON DrugSafetyRequest | DrugSafetyResponse | backend-node pythonService.checkDrugSafety | OPENAI_API_KEY optional, RXNORM_API_ID optional | |
| POST | /drug-check | Drug interaction normalization/risk | JSON DrugCheckRequest | JSON warnings/interactions/recommendations/riskLevel | backend-node pythonService.checkDrugInteractions | RXNORM_API_ID optional, OPENAI_API_KEY for generate_json | |
| POST | /patient-brief | Generate patient brief | JSON PatientBriefRequest | JSON brief payload | backend-node agent/pipeline logic | OPENAI_API_KEY | |
| POST | /soap-note | Generate SOAP note | JSON SoapNoteRequest | JSON soap payload | backend-node pythonService.generateSOAPNote | OPENAI_API_KEY | |
| POST | /extract-followup | Extract follow-up fields from SOAP note | JSON ExtractFollowupRequest | JSON days/reason | not clearly called by backend-node directly | none mandatory | Very simple extraction logic |
| POST | /send-reminder | Send WhatsApp reminder | JSON SendReminderRequest | JSON sent/error | not clearly active in backend-node | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN | Duplicate Twilio responsibility exists in backend-node |

## 13. End-to-End Business Workflows

### 1. Doctor registration/login
- Frontend: Login.tsx, Register.tsx, AuthContext.tsx.
- Backend: POST /api/auth/register, POST /api/auth/login, GET /api/auth/validate-token.
- DB: User.
- AI service: not involved.

### 2. Patient creation
- Frontend: Patients.tsx, NewConsultation.tsx quick-add flow.
- Backend: POST /api/patients.
- DB: Patient.
- AI service: not involved.

### 3. New consultation
- Frontend: NewConsultation.tsx.
- Backend: POST /api/consultations.
- DB: Consultation.
- AI service: not yet involved until audio upload.

### 4. Audio upload/recording
- Frontend: NewConsultation.tsx browser recording or file upload.
- Backend: POST /api/consultations/:id/upload-audio.
- DB: Consultation audio metadata + Transcription + AiTask creation.
- AI service: /transcribe called indirectly by backend async workflow.

### 5. Transcription
- Frontend: socket listeners in NewConsultation.tsx and PastConsultations.tsx; transcript viewing in Dashboard/PatientDetail/PastConsultations.
- Backend: aiTaskService + pythonService; GET /api/consultations/transcriptions/:id and GET /api/consultations/:id/ai-task.
- DB: Transcription, AiTask, Consultation status updates.
- AI service: POST /transcribe.

### 6. SOAP / clinical report generation
- Frontend: ReportPreviewModal, Dashboard.tsx, PatientDetail.tsx, PastConsultations.tsx.
- Backend: aiWorkflowService runSoapWorker, openaiService.generateSOAPNote, preview/report endpoints.
- DB: Transcription.analysis, Consultation.medicalInfo, Report.
- AI service: optionally /soap-note and OpenAI inside ai-service.

### 7. Report preview / save / export
- Frontend: ReportPreviewModal, Reports.tsx, Dashboard.tsx, PastConsultations.tsx, PatientDetail.tsx.
- Backend: POST preview, POST save, POST generate PDF, GET /api/reports, GET download.
- DB: Report.
- AI service: indirect only through previously generated task results.

### 8. Follow-up scheduling
- Frontend: FollowUps.tsx and report save flows.
- Backend: POST /api/followups, saveReportPreview auto appointment sync, reminder worker.
- DB: FollowUp and sometimes Appointment.
- AI service: extract-followup style logic exists but backend mostly uses backend-side OpenAI extraction.

### 9. WhatsApp appointment invitation and confirmation
- Frontend: BookAppointment.tsx for public booking; Appointments.tsx for staff view.
- Backend: POST /api/appointments, Twilio send helpers, POST /api/webhooks/twilio/whatsapp.
- DB: Appointment, FollowUp.
- AI service: separate Python reminder endpoint exists but current active flow is mostly backend-node Twilio logic.

### 10. Subscription/payment flow
- Frontend: Pricing.tsx, SubscriptionSuccess.tsx, SubscriptionManagement.tsx, super-admin subscription plan pages.
- Backend: plan list APIs, create checkout session, Stripe webhook, user subscription APIs.
- DB: SubscriptionPlan, UserSubscription, User.subscriptionPlanId.
- AI service: not involved.

### 11. Super-admin flow
- Frontend: super-admin pages in frontend/src/pages/super-admin.
- Backend: /api/super-admin/* routes.
- DB: User, SubscriptionPlan, Consultation, Transcription metrics.
- AI service: not involved directly.

## 14. Git and Version History Status

Repository status at inspection time:
- Current branch: my-working-code
- Local main branch exists and is behind origin/main by 6 commits.
- Remote branches visible: origin/main, origin/HEAD -> origin/main
- Recent active commits include:
  - 622044c Add package-lock.json for dependency management
  - 459491e Update .gitignore and enhance localization for dashboard; improve patient name display in FollowUps
  - e9d4077 docs: improve project README
  - bbeed01 feat: add WiredTiger storage engine support and local MongoDB fallback for user accounts
  - cd4b05a feat: enhance transcription and SOAP note generation with improved demo mode and speaker detection
  - a3e1c0f feat: add in-memory MongoDB support for DEMO_MODE and improve user registration/login flow
  - 1aba568 Implement current clinic workflow updates
  - f2caa5c Format SOAP output for clinical reports
  - 6d91a7d Fix transcription timeouts and report preview rendering
  - 94d9c2c Initial commit
- Stash exists: refs/stash with emergency-backup metadata.

Working tree status:
- Modified files detected by git status --short:
  - backend-node/src/controllers/consultationController.js
  - start-local.ps1
- No untracked files were listed in the current status command.
- Repository is dirty, not clean.
- Branch listing output suggests the repo history includes substantial local work and likely both committed and previously stashed/uncommitted changes.

Conflict marker scan:
- No real merge conflict markers were found.
- The only matches came from lines of repeated = characters in start-local.ps1 banners.

## 15. Security Review

### Critical

1. Real secrets are present in local .env files.
- Files: backend-node/.env, ai-service/.env
- Findings: API keys, JWT secret, and Twilio credentials were detectable during inspection.
- Impact: If these files were ever shared, all exposed credentials should be rotated immediately.

### High

2. Twilio webhook lacks request signature verification.
- File: backend-node/src/controllers/twilioWebhookController.js
- Impact: Anyone who can hit the webhook endpoint can attempt to confirm/cancel appointments by crafting requests.

3. Public debug/test OpenAI routes are exposed without auth.
- Files: backend-node/src/routes/testRoutes.js, backend-node/src/controllers/testController.js
- Endpoints: /api/test/openai, /api/test/openai-soap
- Impact: Unauthenticated users can trigger AI usage and leak operational behavior.

4. Login still supports legacy plaintext password fallback.
- File: backend-node/src/controllers/authController.js
- Impact: If any user documents still contain plaintext password fields, security posture is materially weaker and migration should be forced instead of tolerated indefinitely.

### Medium

5. AI service uses allow_origins=["*"] with credentials enabled.
- File: ai-service/app/main.py
- Impact: Cross-origin exposure is too permissive for production.

6. Socket.IO connections are not authenticated at connection time.
- File: backend-node/src/server.js, frontend/src/services/socket.ts
- Impact: Any client reaching the backend can listen to global emitted events unless reverse proxy/network restrictions are in place.

7. Reminder runner endpoint can be weakly protected if REMINDER_RUN_SECRET is unset.
- File: backend-node/src/controllers/reminderController.js
- Endpoint: /api/reminders/run
- Impact: Operational job endpoint may be callable without strong auth.

8. Patient file upload route lacks strict MIME allowlisting and content validation.
- Files: backend-node/src/routes/patientFileRoutes.js, backend-node/src/controllers/patientFileController.js
- Impact: Arbitrary file types can be uploaded into patient_files storage.

9. Appointment booking is public and not obviously protected by CAPTCHA/business validation.
- File: backend-node/src/routes/appointmentRoutes.js
- Impact: Spam/abuse risk.

10. Startup bootstraps super-admin credentials from env.
- File: backend-node/src/server.js
- Impact: Convenient for demo, but risky in production without disciplined secret handling.

### Low

11. Health endpoints expose environment and dependency details.
- Files: backend-node/src/app.js, ai-service/app/main.py
- Impact: Useful for attackers during reconnaissance.

12. Console logging includes operational details and could expose sensitive metadata.
- Files: multiple backend-node and ai-service service/controller files.
- Impact: Logs may reveal file paths, IDs, and integration behavior.

13. Legacy backend contains weak default credentials in seed logic.
- File: backend-legacy/seed_super_admin.py
- Impact: Deprecated code still contains insecure patterns that should not be reused.

## 16. Code Quality Review

Main findings:
- Large files that should be split:
  - backend-node/src/controllers/consultationController.js
  - backend-node/src/services/aiTaskService.js
  - backend-legacy/app.py
  - frontend/src/pages/NewConsultation.tsx
  - frontend/src/pages/PastConsultations.tsx
  - frontend/src/pages/PatientDetail.tsx
- Duplicate UI/business logic:
  - Dashboard.tsx, PatientDetail.tsx, and PastConsultations.tsx duplicate transcription fetch, modal, and PDF/report logic.
  - Multiple frontend pages rebuild API_ROOT logic instead of consistently using apiFetch.ts.
- Inconsistent naming:
  - User model uses fullName while frontend/auth payloads often use full_name.
  - Some code expects firstName/lastName for doctor names even though User schema stores fullName.
- Weak validation:
  - Controllers rely mostly on ad hoc checks and Mongoose, with no consistent request schema validation.
- Likely latent bug:
  - frontend/src/services/subscriptionService.ts references axios, AxiosResponse, API_ROOT, and handleApiError without visible imports/definitions in the inspected file.
- Likely data mismatch bug:
  - backend-node/src/services/followupInvitationService.js reads User.firstName/lastName, but active User model only defines fullName.
- Deprecated/reference folder:
  - backend-legacy should be clearly marked archival and excluded from future active changes.
- Duplicate/unclear files:
  - frontend/src/pages/EditPatient.tsx and frontend/src/pages/PatientEdit.tsx both exist.
  - root ApiError.js duplicates an active utility name already present under backend-node/src/utils/ApiError.js.
- TODO/debug leftovers:
  - Test scripts in ai-service are ad hoc manual scripts, not structured tests.
  - Several direct console.log/print statements remain in operational paths.

Improvement suggestions:
- Extract consultation/report/transcription UI into shared hooks/components.
- Normalize API contracts to one casing convention.
- Introduce request schema validation on backend.
- Separate durable job execution from request handlers.
- Remove or archive duplicate/legacy files after verification.

## 17. Performance Review

Potential bottlenecks and risks:
- Large uploads:
  - backend-node allows up to MAX_UPLOAD_SIZE_MB; ai-service currently reads the entire uploaded file into memory before writing temp content.
- Audio processing bottlenecks:
  - AI service transcription is synchronous per request and depends on external OpenAI latency.
- Long-running API requests:
  - backend uses 10-minute Axios timeouts to AI service; report and transcription operations can be lengthy.
- Missing pagination:
  - FollowUps and Appointments list endpoints are not paginated.
- Missing indexes:
  - Appointment and FollowUp query paths lack obvious doctor/date/status indexes.
- Repeated DB queries:
  - Report and patient brief flows fetch related consultation/patient data in multiple steps.
- Expensive frontend renders:
  - Large modal-heavy pages keep substantial state in one component.
- Large bundle risk:
  - Many pages still import axios directly instead of one normalized client; charts, Stripe, icons, and PDF tooling increase bundle weight.
- AI service timeout risk:
  - Dependency on OpenAI and FFmpeg without background queueing means request spikes can hurt responsiveness.
- Blocking operations:
  - Synchronous file system operations appear in report deletion, patient file deletion, and PDF generation paths.
- Realtime inefficiency:
  - Backend emits some events globally and to rooms, duplicating traffic.
- Reminder scheduling reliability:
  - In-memory setTimeout scheduling does not survive process restarts and can drift.

## 18. Testing Status

Observed tests/framework status:
- No formal backend automated test suite found.
- No formal frontend automated test suite found.
- No CI test config found in the inspected files.
- AI service includes ad hoc scripts only:
  - ai-service/test_transcribe.py
  - ai-service/transcribe_test.py
- Legacy backend includes test_openai.py, also ad hoc.

Missing test areas:
- Auth success/failure and token expiry.
- Consultation upload -> AI task -> transcription pipeline.
- Report preview/save/generate flows.
- Twilio webhook confirm/decline parsing.
- Stripe webhook and subscription state transitions.
- Patient file upload/download/delete/analyze.
- Frontend protected routes and role-based routing.

Suggested backend tests:
- Route auth/authorization tests.
- Consultation pipeline controller/service tests with mocked AI responses.
- Twilio webhook verification and appointment confirmation tests.
- Stripe webhook handler tests.
- Mongoose model validation tests.

Suggested frontend tests:
- AuthContext login/logout/token restore.
- ProtectedRoute and SuperAdminRoute behavior.
- NewConsultation success/error/progress UI.
- Reports list/download/delete UI.
- Pricing/checkout initiation flow.

Suggested AI service tests:
- /health startup assumptions.
- /transcribe with mocked OpenAI Whisper client.
- drug-check and drug-safety deterministic prompt parsing.
- soap-note and patient-brief response structure.

Suggested end-to-end tests:
- Doctor login -> patient create -> consultation -> upload -> transcript -> report save.
- Public appointment booking -> Twilio webhook confirm -> follow-up creation.
- Stripe checkout success webhook -> subscription state visible in UI.

Manual testing checklist for FYP demo:
- Doctor registration and login.
- Create patient with required fields.
- Start consultation and upload valid audio.
- Watch realtime progress until AI task completes.
- Open transcription and edit a segment.
- Open report preview and save it.
- Download PDF report.
- Schedule a follow-up and send reminder.
- Submit a public appointment request.
- Confirm super-admin login and plan/user management pages load.

## 19. Deployment Readiness

Recommended production architecture:
- Frontend: static build served by Nginx, Vercel, Netlify, or Azure Static Web Apps.
- Backend-node: containerized Node/Express service.
- AI service: separate container/service with Python 3.11/3.13 and FFmpeg installed.
- Database: MongoDB Atlas or managed MongoDB.
- File storage: move uploads from local disk to persistent/shared object storage.

Frontend deployment options:
- Static host for built Vite app.
- Nginx-based Docker image already exists.

Backend deployment options:
- Docker container from backend-node/Dockerfile.
- Azure App Service for Containers, Azure Container Apps, Render, Railway, or a VPS.

AI service deployment options:
- Separate Dockerized FastAPI service.
- Must include FFmpeg and Python version compatibility.

MongoDB notes:
- Local dev uses mongodb://localhost:27017/clinix_ai.
- Production should use Atlas or another managed deployment with IP restrictions and backups.

Production env requirements:
- Backend-node: all auth, DB, AI, Stripe, Twilio, URL, upload, and reminder vars.
- AI service: OPENAI_API_KEY, AI_SERVICE_PORT/HOST, RxNorm/Twilio vars as needed.
- Frontend: VITE_API_URL pointing at public backend URL.

Operational requirements:
- FFmpeg must be installed on AI service host.
- Upload storage must be persistent and ideally shared/object-based.
- Public HTTPS URLs are required for Stripe and Twilio webhooks.
- CORS must be tightened to real frontend origins.
- HTTPS is effectively mandatory for auth tokens, webhooks, and browser security.

Suggested domain layout:
- app.clinix-ai.example -> frontend
- api.clinix-ai.example -> backend-node
- ai.clinix-ai.example -> ai-service (internal or protected if possible)

Docker / compose status:
- docker-compose.yml exists and captures the three active services.
- Good for local orchestration, but not enough by itself for robust production operations.

Deployment blockers:
- Secrets present in local .env files need rotation and proper secret management.
- Twilio webhook verification missing.
- Debug/test routes should be removed or protected.
- Upload storage is local-disk based.
- Reminder and AI task processing are not durable job systems.
- AI service startup hard-requires OPENAI_API_KEY and FFmpeg.

## 20. Cleanup Plan

### Safe to delete from ZIP/sharing
- .venv folders
- node_modules folders
- uploads folders and generated media
- local .env files
- temp_diff.txt
- ai-service/temp_transcribe_test.wav
- ad hoc local logs/cache if present

### Should not delete
- Source code under frontend/src, backend-node/src, ai-service/app
- .env.example files
- Dockerfiles and docker-compose.yml
- README files
- start-local.ps1

### Needs review before delete
- backend-legacy folder
- root ApiError.js
- frontend/src/pages/EditPatient.tsx if PatientEdit.tsx is the real active file
- ai-service/test_transcribe.py and transcribe_test.py
- .vscode/settings.json if this workspace is shared

### Deprecated but keep temporarily
- backend-legacy as migration/reference artifact until active stack is fully stabilized

### Security cleanup
- Remove .env files from any shared ZIP/package.
- Rotate JWT, OpenAI, Twilio, Stripe, and any other exposed secrets.
- Remove test/debug endpoints before external exposure.

### Dependency cleanup
- Audit frontend and backend packages for unused dependencies.
- Review duplicate API helper patterns and remove dead code.

### Documentation cleanup
- Mark backend-legacy clearly as deprecated.
- Consolidate README instructions around the active Node + FastAPI architecture.
- Remove outdated Stripe markdown files if no longer authoritative.

## 21. Improvement Roadmap

### Phase 1: Make project run reliably
- Priority: Highest
- Difficulty: Medium
- Modules: start-local.ps1, backend-node env/config, ai-service startup, frontend API config
- Tasks:
  - Normalize one supported local setup path.
  - Verify all env examples match actual code usage.
  - Ensure AI service Python version and FFmpeg requirements are explicit.
  - Remove runtime ambiguity between backend-node and backend-legacy.
- Outcome: Reproducible local startup.

### Phase 2: Fix critical bugs/security
- Priority: Highest
- Difficulty: Medium to High
- Modules: authController, twilioWebhookController, testRoutes, ai-service main.py, .env handling
- Tasks:
  - Rotate exposed secrets.
  - Add Twilio webhook signature validation.
  - Remove or protect /api/test/* routes.
  - Remove plaintext password fallback.
  - Tighten CORS and socket access for production.
- Outcome: Safer demo and deployable security baseline.

### Phase 3: Clean code and remove bloat
- Priority: High
- Difficulty: Medium
- Modules: frontend pages, backend-legacy, duplicate helpers/files
- Tasks:
  - Split large components/controllers/services.
  - Remove duplicate page flows and centralize API access.
  - Review root temp/duplicate files.
  - Clarify archival status of backend-legacy.
- Outcome: Easier maintenance and onboarding.

### Phase 4: Testing and QA
- Priority: High
- Difficulty: Medium
- Modules: backend-node routes/services, frontend route flows, ai-service endpoints
- Tasks:
  - Add backend integration tests with mocked external APIs.
  - Add frontend route/component tests.
  - Add AI service unit tests for prompt-response parsing.
  - Build a manual smoke-test checklist into docs.
- Outcome: Fewer regressions.

### Phase 5: Performance improvement
- Priority: Medium
- Difficulty: Medium
- Modules: ai-service transcription path, backend query paths, frontend heavy pages
- Tasks:
  - Avoid full-file in-memory reads for large uploads.
  - Add missing Mongo indexes.
  - Paginate appointments/follow-ups.
  - Reduce duplicated global Socket.IO emissions.
- Outcome: Better responsiveness and scale tolerance.

### Phase 6: Deployment
- Priority: High
- Difficulty: High
- Modules: Dockerfiles, compose, env management, storage, webhook config
- Tasks:
  - Deploy frontend/backend/ai-service separately.
  - Move uploads to persistent storage.
  - Add public HTTPS URLs for Stripe/Twilio.
  - Harden production env and CORS.
- Outcome: Real deployment readiness.

### Phase 7: Final FYP demo polish
- Priority: Medium
- Difficulty: Low to Medium
- Modules: frontend UX, seed/demo data, docs
- Tasks:
  - Seed a clean doctor/patient/demo audio flow.
  - Polish success/error states and loading feedback.
  - Prepare a short operator runbook.
- Outcome: Smoother demo experience.

## 22. Known Issues and Open Questions

Confirmed issues:
- Real secrets exist in local .env files.
- Twilio webhook verification is missing.
- Public test OpenAI routes are exposed.
- Reminder runner protection is optional rather than mandatory.
- followupInvitationService expects doctor firstName/lastName although User stores fullName.
- subscriptionService.ts appears to reference missing helpers/imports.

Suspected issues:
- Some Stripe verification flows are placeholders rather than complete.
- Dashboard top diagnoses aggregation may not match actual analysis field structure.
- AI service OPENAI_MODEL env may not control all helper calls because helpers hardcode model values.
- In-memory reminder scheduling may silently fail after restarts.

Questions to ask your group member:
- Is backend-legacy still needed for any hidden feature or just archival?
- Which source of truth should be used for subscriptions: current Stripe flow or fallback plans only?
- Are Twilio sandbox credentials only for demo, or is production WhatsApp expected?
- Should ai-service or backend-node own follow-up reminder sending long term?
- Which file is the real patient edit page: EditPatient.tsx or PatientEdit.tsx?

Information still missing from repo-only inspection:
- Real production infrastructure choice.
- Actual MongoDB sample data and seed completeness.
- Whether Stripe products/prices already exist in the target account.
- Whether public Twilio webhook URLs are configured externally.

Needs manual testing:
- Public appointment booking end to end.
- Twilio confirm/decline reply parsing.
- Stripe checkout success/cancel/webhook loop.
- AI transcription on real long audio files.
- Urdu speech flow versus English speech flow.

## 23. Final Quick Reference

### Local run commands
```powershell
Set-Location D:\clinixai-stage
.\start-local.ps1
```

Manual alternative:
```powershell
Set-Location D:\clinixai-stage\ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

Set-Location D:\clinixai-stage\backend-node
npm install
npm run dev

Set-Location D:\clinixai-stage\frontend
npm install
npm run dev
```

### Localhost URLs
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Backend health: http://localhost:5000/health
- AI service: http://localhost:8001
- AI service health: http://localhost:8001/health

### Main env variable names
- Frontend: VITE_API_URL
- Backend: MONGODB_URI, JWT_SECRET, PYTHON_AI_SERVICE_URL, OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, REMINDER_RUN_SECRET
- AI service: OPENAI_API_KEY, AI_SERVICE_PORT, RXNORM_API_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

### Main folders
- frontend/
- backend-node/
- ai-service/
- backend-legacy/ (deprecated/reference)

### Main workflows
- Doctor auth
- Patient management
- Consultation audio upload/recording
- AI transcription and SOAP generation
- Report preview/save/PDF download
- Follow-up and appointment messaging
- Subscription and super-admin management

### Highest priority fixes
1. Rotate exposed secrets and remove local .env files from anything shared.
2. Add Twilio webhook signature verification.
3. Disable or protect /api/test/* routes.
4. Remove plaintext password fallback and harden auth.
5. Replace in-process reminder/task assumptions with safer operational patterns.

### Recommended next step
- Treat this knowledge base as the handoff document, then prioritize Phase 1 and Phase 2 roadmap items before any deployment or team-wide sharing.
