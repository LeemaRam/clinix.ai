# Local Stack Verification Report

## 1. Summary

- Overall status: PARTIAL PASS
- Date/time: 2026-05-31 (local)
- Branch: `my-working-code` (dirty: 2 modified files, 1 untracked knowledge-base file)
- Services tested: `frontend` (3000), `backend-node` (5000), `ai-service` (8001)
- Main conclusion: All three services are running and reachable. Health endpoints, MongoDB connectivity, AI service connectivity, FFmpeg availability, public subscription plans, and CORS preflight all pass. Auth gating on protected routes works correctly (401 without token). However, several **public/unauthenticated endpoints are confirmed exploitable**: `/api/test/openai` actually calls live OpenAI without auth, `/api/webhooks/twilio/whatsapp` accepts unsigned requests, and `/api/reminders/run` runs the reminder worker without a secret (env `REMINDER_RUN_SECRET` is not set). Authenticated smoke tests (login, patient create, consultation create, transcription, report) were **not executed** because no safe test credentials were available — see Section 11.

No code files were modified. No database records were created.

## 2. Service Status Table

| Service | URL | Port | Started? | Health status | Notes |
|---|---|---|---|---|---|
| Frontend (Vite) | http://localhost:3000 | 3000 | Yes (PID 16520) | 200 OK, HTML served, Vite HMR active | Single root `index.html` returned |
| Backend API | http://localhost:5000 | 5000 | Yes (PID 15532) | 200 OK, `database.connected=true` | `/health` reports `clinix-ai-api`, env `development` |
| AI Service | http://localhost:8001 | 8001 | Yes (PID 16736) | 200 OK | `openai_api_key_present=true`, `ffmpeg_available=true`, `demo_mode=false` |
| Legacy backend | n/a | (would be 5000) | Not started (correctly) | n/a | Deprecated, excluded per scope |

## 3. Environment Check

Secrets are not printed. Only variable names + non-secret config URLs/ports are shown.

Frontend `.env` keys: `VITE_API_URL`
- `VITE_API_URL=http://localhost:5000` — matches backend.

Backend `.env` keys present:
- Required: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `PYTHON_AI_SERVICE_URL`, `OPENAI_API_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
- AI/OpenAI: `OPENAI_MODEL=gpt-4o-mini`, `OPENAI_WHISPER_MODEL=whisper-1`, `OPENAI_API_BASE_URL`
- Google: `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_API_KEY`
- Upload/misc: `MAX_UPLOAD_SIZE_MB=1024`, `DEMO_MODE=false`, `RXNORM_API_ID`
- Super-admin bootstrap: `SUPER_ADMIN_EMAIL` (set), `SUPER_ADMIN_PASSWORD` (set), `SUPER_ADMIN_FULL_NAME`

Backend `.env` keys MISSING vs knowledge base / code expectations:
- `REMINDER_RUN_SECRET` — **missing**. Confirmed live: `/api/reminders/run` runs without any secret (HTTP 200).
- `FRONTEND_URL` — not present; backend falls back to defaults / `CORS_ORIGIN`.
- `NODE_ENV` — not set in `.env`; `/health` reports `environment=development` (likely set elsewhere or default).
- `UPLOAD_AUDIO_DIR`, `UPLOAD_REPORTS_DIR` — not set; backend will use defaults.
- `OPENFDA_API_KEY` — not set (optional).
- `SUPER_ADMIN_STORAGE_LIMIT_GB` — not set (optional).

AI service `.env` keys present: `AI_SERVICE_PORT=8001`, `AI_SERVICE_HOST=0.0.0.0`, `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o-mini`, `NODE_ENV=production`, `DEMO_MODE=false`, `MAX_FILE_MB=50`, `RXNORM_API_ID`.

AI service `.env` keys MISSING vs `followup_service.py` usage:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` — not present in AI service `.env`. If the AI service's `/send-reminder` is ever invoked, it will fail. Current backend-node owns Twilio sending, so this is latent only.

Mismatches and inconsistencies:
- AI service `NODE_ENV=production` while backend reports `environment=development`. Mixed runtime modes. Cosmetic on local, but worth normalizing.
- `MAX_UPLOAD_SIZE_MB=1024` (backend) vs `MAX_FILE_MB=50` (AI service). Backend can accept files the AI service may refuse; effectively the smaller AI limit governs end-to-end transcription size.
- Stripe configured but `subscriptionplans` collection is empty (0 docs); the public plans endpoint is serving hardcoded fallback plans with empty `stripePriceId`, so no real Stripe checkout would currently work.

## 4. Connectivity Matrix

| Flow | Status | Evidence | Notes |
|---|---|---|---|
| Frontend → Backend | PASS | `http://localhost:3000` 200; CORS preflight to `/api/auth/login` returned 204 with `Access-Control-Allow-Origin: http://localhost:3000` | Allowed methods: `GET,POST,PUT,DELETE,OPTIONS`; allowed headers include `Content-Type,Authorization` |
| Backend → MongoDB | PASS | `/health` reports `database.connected=true`; mongosh listed 10 collections in `clinix_ai` | DB name: `clinix_ai` |
| Backend → AI Service | PASS (config) | `PYTHON_AI_SERVICE_URL=http://localhost:8001`; AI `/health` returns 200 from the same host | Live AI call from backend not invoked in this pass; configuration confirmed |
| AI Service → OpenAI | PASS (config) | AI `/health` shows `openai_api_key_present=true`, SDK 1.108.2 | One live OpenAI call confirmed indirectly via backend `/api/test/openai` returning `"Okay!"` |
| AI Service → FFmpeg | PASS | `ffmpeg_available=true`, paths returned from `/health` | ffmpeg + ffprobe both detected on PATH |
| Backend → Twilio | CONFIGURED, NOT EXERCISED | All three Twilio env vars present; `TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886` (sandbox) | No real message sent per your rules |
| Backend → Stripe | CONFIGURED, NOT EXERCISED | Stripe keys present; success/cancel URLs set | No checkout session created per your rules; plans served via fallback (empty `stripePriceId`) |
| Backend → Google Speech | CONFIGURED (optional) | `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_CLOUD_API_KEY` keys present | Not exercised |
| Backend → RxNorm | CONFIGURED | `RXNORM_API_ID` present in both backend and AI service | Public `/api/ai/drug-safety` returned `200 {warnings:[],interactions:[],recommendations:[]}` for empty input |

## 5. API Smoke Test Results

### Auth
| Endpoint | Method | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|
| `/api/auth/login` (OPTIONS preflight) | OPTIONS | 204 with CORS headers | 204, origin allowed | PASS | |
| `/api/auth/login` | POST | Login with credentials | **NOT TESTED** | SKIPPED | No safe test credentials supplied; awaiting your approval before creating a test doctor |
| `/api/auth/validate-token` | GET | 200 with valid token | **NOT TESTED** | SKIPPED | Depends on prior login |

### Patients / Consultations / Reports / Dashboard / Super-admin (protected)
| Endpoint | Method | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|
| `/api/patients` | GET | 401 without token | 401 Unauthorized | PASS | Auth middleware works |
| `/api/appointments` | GET | 401 without token | 401 Unauthorized | PASS | |
| `/api/followups` | GET | 401 without token | 401 Unauthorized | PASS | |
| `/api/dashboard/stats` | GET | 401 without token | 401 Unauthorized | PASS | |
| `/api/super-admin/stats` | GET | 401 without token | 401 Unauthorized | PASS | Role guard not yet differentiated from auth guard at this layer |
| POST patient create | POST | Create test patient | **NOT TESTED** | SKIPPED | Awaiting approval to create test record |
| POST consultation create | POST | Create test consultation | **NOT TESTED** | SKIPPED | Depends on patient + auth |

### AI / Transcription
| Endpoint | Method | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|
| AI `/health` | GET | 200 | 200, all flags healthy | PASS | |
| AI `/` | GET | 200 | 200 `{"status":"ok",...,"docs":"/health"}` | PASS | `/docs` route not enabled; root advertises `/health` instead |
| `/api/test/openai` (backend, public) | GET | 200 `"Okay!"` | 200 `{"success":true,"output":"Okay!"}` | PASS (functional) / FAIL (security) | **Public live OpenAI call** — see Findings |
| `/api/ai/drug-safety` (backend, public) | POST | 200 with empty arrays | 200 `{"warnings":[],"interactions":[],"recommendations":[]}` | PASS (functional) / FAIL (security) | Unauthenticated public endpoint |
| AI `/transcribe` end-to-end | POST | Whisper transcription on small sample | **NOT TESTED** | SKIPPED | No sample audio approved; would consume OpenAI quota |

### Subscriptions
| Endpoint | Method | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|
| `/api/subscription/plans` | GET | Public plan list | 200 with `starter-monthly`, `pro-monthly`, ... | PASS | Plans come from fallback array (`subscriptionplans` collection is empty); `stripePriceId` is blank |
| `/api/subscription/create-checkout-session` | POST | Stripe session | **NOT TESTED** | SKIPPED | Per your rule, not invoking real Stripe |

### Webhooks / Operational
| Endpoint | Method | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|
| `/api/webhooks/twilio/whatsapp` | POST | TwiML response | 200 `<Response></Response>` from arbitrary unsigned POST | PASS (functional) / FAIL (security) | No Twilio signature verification |
| `/api/reminders/run` | POST | Should require secret | 200 `{checked:0, sent:0, skipped:0, errors:0}` **without any secret** | PASS (functional) / FAIL (security) | `REMINDER_RUN_SECRET` not set in `.env`; endpoint fully open |

## 6. Frontend Verification

- Pages checked: only root `/` was loaded via HTTP. The Vite dev server is serving the React shell (200 OK, HMR script injected). Deep page exercise was not done (would require a real browser session).
- Console/network issues: not measured (no browser automation in this pass).
- Login page status: not opened in a browser this pass — backend `/api/auth/login` preflight is healthy, so a browser-side login should not be blocked by CORS.
- Protected route behavior: backend correctly returns 401 for protected routes, so frontend `ProtectedRoute` should redirect unauthenticated users to `/login`.

## 7. Database Verification

- MongoDB reachable: **Yes** (via backend `/health` and direct `mongosh` to the URI in `backend-node/.env`).
- DB name: `clinix_ai`.
- Collections found (with estimated counts):
  - `users` (2)
  - `patients` (3)
  - `consultations` (4)
  - `transcriptions` (2)
  - `aitasks` (2)
  - `reports` (10)
  - `appointments` (2)
  - `followups` (1)
  - `subscriptionplans` (0)  ← empty; plans endpoint uses fallback
  - `usersubscriptions` (0)
- Test records created in this run: **None**.

## 8. External Integration Verification

| Integration | Status | Notes / real call made? |
|---|---|---|
| OpenAI (backend) | Healthy | Real call: 1 — `/api/test/openai` returned `"Okay!"` (uses live API key) |
| OpenAI (AI service) | Healthy | No direct real call this pass; key presence confirmed at `/health` |
| FFmpeg / ffprobe | Healthy | Detected on PATH; AI service reports `ffmpeg_available=true` |
| Twilio | Configured | No real WhatsApp message sent. Webhook endpoint accepted an unsigned simulated POST |
| Stripe | Configured | No checkout session created. Public plans served from in-code fallback |
| Google Speech | Configured (optional) | Not exercised |
| RxNorm | Configured | Public `/api/ai/drug-safety` returned empty results for empty input (no real RxNorm round-trip verified) |

## 9. Security / Quality Findings

### Critical
1. **Public `/api/test/openai` makes real OpenAI calls without auth.** Confirmed live: `200 {"success":true,"output":"Okay!"}`. Any caller can drain your OpenAI quota or fingerprint your prompts.
2. **Public `/api/reminders/run` runs the reminder worker without a secret.** `REMINDER_RUN_SECRET` is not present in `backend-node/.env`. Confirmed live: returns `200 {checked,sent,skipped,errors}` for an unauthenticated POST. Could send real WhatsApp messages if eligible follow-ups exist.

### High
3. **Twilio webhook `/api/webhooks/twilio/whatsapp` has no Twilio signature verification.** Confirmed: an arbitrary unsigned POST returns `200 <Response></Response>`. An attacker can forge appointment confirm/cancel events.
4. **Public `/api/ai/drug-safety` route accepts unauthenticated POSTs.** Confirmed: `200` for empty payload; with real payloads it will consume OpenAI/RxNorm quota.
5. **Stripe configured but `subscriptionplans` collection is empty and fallback plan `stripePriceId` is blank.** Any attempt at `create-checkout-session` against these IDs will fail or use a missing price.

### Medium
6. **`MAX_UPLOAD_SIZE_MB=1024` on backend** is very large for medical audio and significantly larger than AI service's `MAX_FILE_MB=50`. Mismatched limits can cause confusing user-facing failures and DoS-style memory pressure.
7. **AI service health endpoint exposes detailed environment info** (Python version, platform, SDK versions, ffmpeg paths). Useful for reconnaissance once exposed publicly.
8. **CORS preflight allows only `http://localhost:3000`** which is correct for local — confirm production `CORS_ORIGIN` is tightened before deploy. `FRONTEND_URL` is not set.

### Low
9. **`SUPER_ADMIN_PASSWORD` present in `.env`** and the bootstrap creates/repairs a super-admin on startup. Acceptable for local; must be rotated and removed before any shared deploy.
10. **`NODE_ENV` mismatch**: AI service `.env` sets `NODE_ENV=production` while backend runtime reports `development`. Cosmetic, but worth aligning.
11. **`subscriptionplans` empty** means the super-admin / Stripe seeding script has not been run on this DB.
12. **Working tree is dirty** (`backend-node/src/controllers/consultationController.js`, `start-local.ps1` modified; `PROJECT_KNOWLEDGE_BASE.md` untracked). Not a bug — informational.

## 10. Issues Found

### Issue 1: Public OpenAI test route burns live quota
- Severity: Critical
- Service: backend-node
- File/endpoint: `backend-node/src/routes/testRoutes.js`, `GET /api/test/openai`
- Evidence: `GET http://localhost:5000/api/test/openai => 200 {"success":true,"output":"Okay!"}` without any `Authorization` header.
- Suggested next step: Gate behind `protect` + `authorize('super_admin')`, or remove from production builds via `NODE_ENV` guard.

### Issue 2: Reminder runner has no secret enforcement
- Severity: Critical
- Service: backend-node
- File/endpoint: `backend-node/src/controllers/reminderController.js`, `POST /api/reminders/run`
- Evidence: `REMINDER_RUN_SECRET` absent from `.env`; endpoint returned `200` with no header/query secret.
- Suggested next step: Set `REMINDER_RUN_SECRET` in `.env` and make the controller hard-fail (`401`) when it's missing or the request lacks the matching header/query.

### Issue 3: Twilio webhook accepts unsigned requests
- Severity: High
- Service: backend-node
- File/endpoint: `backend-node/src/controllers/twilioWebhookController.js`, `POST /api/webhooks/twilio/whatsapp`
- Evidence: Arbitrary unsigned `application/x-www-form-urlencoded` POST returned `200 <Response></Response>`.
- Suggested next step: Use Twilio's `validateRequest` (or the `twilio` Node SDK middleware) with `TWILIO_AUTH_TOKEN` and the public webhook URL, and reject when validation fails.

### Issue 4: Public drug-safety endpoint
- Severity: High
- Service: backend-node
- File/endpoint: `backend-node/src/routes/aiRoutes.js`, `POST /api/ai/drug-safety`
- Evidence: `200` returned without auth.
- Suggested next step: Require `protect` middleware; rate-limit per user.

### Issue 5: Subscription plans not seeded; Stripe price IDs blank
- Severity: High (business-blocking)
- Service: backend-node + Mongo
- File/endpoint: `subscriptionplans` collection (0 docs); `seed-stripe-plans.js`
- Evidence: mongosh count `0`; `/api/subscription/plans` serves fallback with `stripePriceId: ""`.
- Suggested next step: Run `npm run seed:stripe` against a Stripe test account, then verify checkout in test mode (only with your explicit approval).

### Issue 6: Upload size mismatch
- Severity: Medium
- Service: backend-node ↔ ai-service
- Evidence: Backend `MAX_UPLOAD_SIZE_MB=1024` vs AI `MAX_FILE_MB=50`.
- Suggested next step: Align both to the same realistic cap (e.g., 50–100 MB) and enforce in the upload middleware.

### Issue 7: AI service Twilio env keys not present
- Severity: Medium (latent)
- Service: ai-service
- Evidence: `ai-service/.env` has no `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_FROM`, but `followup_service.py` uses them.
- Suggested next step: Either add the keys to `ai-service/.env` or document that AI-service-driven reminders are intentionally disabled (backend-node is the sender).

## 11. Manual Tests Still Needed

These were intentionally not executed because they require either creating test data, real credentials, or live external calls:

1. **Authenticated login + token validation** — needs an approved test doctor account.
   - Suggested test user: `email: qa.doctor+test@clinixai.local`, `fullName: QA Doctor`, `role: doctor`, with a temporary password you supply privately in the terminal. I will not call `POST /api/auth/register` until you say go.
2. **Patient create / list / detail** — depends on (1). Suggested test patient: `firstName: Test`, `lastName: Patient`, `phone: +920000000000`, `gender: other`, `dateOfBirth: 2000-01-01`.
3. **Consultation create + audio upload + transcription** — needs (1)(2) and a tiny sample audio file (≤5s). No sample is currently in the repo.
4. **Report preview / save / PDF download** — depends on a completed transcription.
5. **Public appointment booking + Twilio confirm/decline** — would either skip Twilio entirely or actually send a WhatsApp message; requires your approval.
6. **Stripe checkout session create + webhook** — requires your approval and test-mode keys.
7. **Frontend browser-level verification** (console errors, real login UI, role redirects, socket events) — needs a browser session, not a CLI HTTP probe.
8. **Super-admin login + user/plan management UI** — needs the super-admin password, which I have not read or used.

## 12. Recommended Next Action

1. **Set `REMINDER_RUN_SECRET` in `backend-node/.env`** and confirm `POST /api/reminders/run` returns `401` without it. This is the cheapest fix that closes a Critical finding.
2. **Disable or auth-gate `/api/test/openai` and `/api/test/openai-soap`** (e.g., wrap routes with `protect` + `authorize('super_admin')`, or only mount when `NODE_ENV !== 'production'`).
3. **Approve a one-time auth smoke test**: tell me to register a throwaway test doctor (I'll prompt you for the password directly in the terminal so it never reaches the model) and I will then run login → patient create → consultation create as read/write smoke tests with full evidence.
4. **Add Twilio signature verification** to `POST /api/webhooks/twilio/whatsapp` before any production WhatsApp number is wired up.
5. **Seed subscription plans** by running `npm run seed:stripe` (only with your approval) so that `subscriptionplans` collection is populated and `stripePriceId` is no longer blank.
