# Final Project Issue Tracker — Clinix.ai

**Project:** Clinix.ai
**Root:** `D:\clinixai-stage`
**Date:** 2026-05-31
**Mode:** Documentation only. No source code edited, no files deleted, nothing staged or committed. No secrets exposed (environment values are referenced by variable name only).

**Sources consolidated:** `PROJECT_KNOWLEDGE_BASE.md`, `LOCAL_STACK_VERIFICATION_REPORT.md`, `PROJECT_RESCUE_AND_REFACTOR_PLAN.md`, `NEXT_IMPLEMENTATION_SESSIONS.md`, `SECURITY_FIX_REPORT.md`, `TWILIO_WEBHOOK_SECURITY_FIX_REPORT.md`, `AUTH_RATE_LIMIT_FIX_REPORT.md`, `UI_UX_AUDIT_REPORT.md`, `UI_UX_FIX_REPORT.md`, `UI_UX_SECOND_FIX_REPORT.md`, `TARGETED_UI_POLISH_REPORT.md`, `I18N_LEGACY_CLEANUP_REPORT.md`, `DUPLICATE_PATIENT_EDIT_CLEANUP_REPORT.md`, `GIT_CLEANUP_RECOMMENDATION.md`, `FRONTEND_UI_QA_REPORT.md`.

> Note on git state: several fixes below were implemented in the working tree but may not yet be committed to the deployable branch (`main`). They are functionally "Done" in code; committing/verifying them is tracked as a deployment task in §8.

---

## 1. Completed Fixes

### CF-1 — Auth `validate-token` excluded from strict login rate limiter
- **Files changed:** `backend-node/src/app.js`
- **Evidence/source:** `AUTH_RATE_LIMIT_FIX_REPORT.md`
- **Build/test result:** `node --check` pass; live test — `GET /api/auth/validate-token` stayed `401` across 8 calls (no `429`); `POST /api/auth/login` still `429` after 5 bad attempts (brute-force protection intact).
- **Closes:** C-6.
- **Status:** Done

### CF-2 — Twilio WhatsApp webhook signature verification
- **Files changed:** `backend-node/src/config/env.js`, `backend-node/src/controllers/twilioWebhookController.js`, `backend-node/src/routes/twilioWebhookRoutes.js`, `backend-node/.env.example`
- **Evidence/source:** `TWILIO_WEBHOOK_SECURITY_FIX_REPORT.md` (supersedes the TODO-only note in `SECURITY_FIX_REPORT.md` item 4)
- **Build/test result:** `node --check` pass; unsigned POST → `403`, invalid signature → `403`, dev bypass (`TWILIO_WEBHOOK_VALIDATE=false`) → `200` TwiML. No real WhatsApp messages sent.
- **Closes:** C-3.
- **Status:** Done

### CF-3 — Protect reminder/test/AI endpoints
- **Files changed:** `backend-node/src/controllers/reminderController.js`, `backend-node/src/routes/testRoutes.js`, `backend-node/src/routes/aiRoutes.js`
- **Evidence/source:** `SECURITY_FIX_REPORT.md`, `LOCAL_STACK_VERIFICATION_REPORT.md`
- **Build/test result:** `POST /api/reminders/run` without secret → `401`; `GET /api/test/openai` & `POST /api/test/openai-soap` without super-admin → `401`; `POST /api/ai/drug-safety` without auth → `401`. Regression sweep: `/health`, `/api/subscription/plans`, protected routes unchanged.
- **Closes:** C-2; partially S-6.
- **Status:** Done

### CF-4 — Report-to-appointment sync hardened (non-blocking)
- **Files changed:** `backend-node/src/controllers/consultationController.js`
- **Evidence/source:** `GIT_CLEANUP_RECOMMENDATION.md` (Group A)
- **Build/test result:** Defensive: derives `doctorId` safely, skips appointment creation when patient phone missing, wraps `createOrUpdateAppointmentForReport` in try/catch so a failed sync no longer blocks report save.
- **Status:** Done

### CF-5 — i18n pipeline repair + key backfill
- **Files changed:** `frontend/src/i18n/index.ts`, `frontend/src/locales/en/translation.json`, `frontend/src/pages/Login.tsx`, `frontend/src/pages/Register.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/pages/NewConsultation.tsx`
- **Evidence/source:** `UI_UX_FIX_REPORT.md`, `UI_UX_AUDIT_REPORT.md` (F-001)
- **Build/test result:** `npm run build` ✅ (Vite 5.4.8). Fixed broken locale import; backfilled 11 → 521 keys across 13 namespaces. Eliminated raw-key leaks (`auth.backToSignIn`, etc.) and mid-word table-header wraps. Lint: pre-existing debt only, no new errors.
- **Closes:** F-001, F-020, F-017 (root cause).
- **Status:** Done

### CF-6 — Session resilience + page headers (second UI pass)
- **Files changed:** `frontend/src/context/AuthContext.tsx`, `frontend/src/locales/en/translation.json`, `frontend/src/components/layout/Header.tsx`
- **Evidence/source:** `UI_UX_SECOND_FIX_REPORT.md`, `FRONTEND_UI_QA_REPORT.md` (NEW-1/2/3/4/5)
- **Build/test result:** `npm run build` ✅ (8.21s). `isTokenValid` now only logs out on 401/403 (429/network/5xx preserve session). Added `speech.languages.*`, corrected Pricing copy, added topbar titles/subtitles for `/analytics`, `/follow-ups`, `/appointments`. Lint 196→ baseline maintained (no new errors).
- **Closes:** C-5, NEW-1, NEW-2, NEW-3, NEW-4, NEW-5.
- **Status:** Done

### CF-7 — Targeted UI polish (Session 4)
- **Files changed:** `frontend/src/components/EmptyState.tsx` (new), `frontend/src/pages/Analytics.tsx`, `frontend/src/pages/PastConsultations.tsx`, `frontend/src/pages/FollowUps.tsx`, `frontend/src/pages/Appointments.tsx`, `frontend/src/pages/Settings.tsx`, `frontend/src/components/common/LanguageSelector.tsx`, `frontend/src/locales/en/translation.json`
- **Evidence/source:** `TARGETED_UI_POLISH_REPORT.md`
- **Build/test result:** `npm run build` ✅ (7.73s). Lint **improved** 196 → 192 problems (177 → 173 errors), no new errors in changed files. Added shared `EmptyState`; Analytics empty states (no more green zero-bars); enum labels on Past Consultations + header `whitespace-nowrap`; empty state + status filter on Follow-ups/Appointments; Settings "Urdu (coming soon)" disabled; language picker "EN" pill replacing flag emoji.
- **Closes:** PRE-1, PRE-2, PRE-3, PRE-4, PRE-5, PRE-6, PRE-7, F-025, R-9.
- **Status:** Done

### CF-8 — Retire legacy i18n locale tree
- **Files changed:** moved `frontend/src/i18n/locales/en.json` & `ur.json` → `frontend/src/i18n/locales/legacy/`
- **Evidence/source:** `I18N_LEGACY_CLEANUP_REPORT.md`
- **Build/test result:** `npm run build` ✅. Confirmed no active imports of `i18n/locales`. Active file remains `frontend/src/locales/en/translation.json`.
- **Closes:** C-8, R-2.
- **Status:** Done

### CF-9 — Resolve duplicate Patient-edit page
- **Files changed:** moved `frontend/src/pages/EditPatient.tsx` → `frontend/src/pages/_archive/EditPatient.tsx`
- **Evidence/source:** `DUPLICATE_PATIENT_EDIT_CLEANUP_REPORT.md`
- **Build/test result:** `npm run build` ✅. Confirmed `PatientEdit.tsx` is the routed page in `App.tsx`; orphan archived, not deleted.
- **Closes:** C-7, R-1.
- **Status:** Done

### CF-10 — Local-stack tooling fixes
- **Files changed:** `start-local.ps1`
- **Evidence/source:** `GIT_CLEANUP_RECOMMENDATION.md` (Group C)
- **Build/test result:** Renamed reserved `$pid` variable; added FFmpeg/ffprobe auto-detection into AI service job PATH. Tooling only.
- **Status:** Done

---

## 2. Pending Critical Issues

### P-C1 — Stripe subscription plans not seeded; `stripePriceId` blank (business-blocking)
- `subscriptionplans` collection has 0 docs; `/api/subscription/plans` serves an in-code fallback with empty `stripePriceId`, so any paid checkout fails at "Get started".
- **Source:** C-1; `LOCAL_STACK_VERIFICATION_REPORT.md` §7, Issue 5; `NEXT_IMPLEMENTATION_SESSIONS.md` Session 6.
- **Fix:** Seed via `npm run seed:stripe` against a Stripe **test** account, verify non-empty `stripePriceId`, smoke a test-mode checkout. Until then hide paid CTAs behind a flag.

### P-C2 — Secrets present in local `.env` files need rotation
- `JWT_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `SUPER_ADMIN_PASSWORD` exist in local `.env` files. `.env` is gitignored (not tracked), but if ever shared, treat as compromised.
- **Source:** C-4; `PROJECT_KNOWLEDGE_BASE.md` §15; `LOCAL_STACK_VERIFICATION_REPORT.md` §9.
- **Fix:** Rotate all listed secrets, move to the hosting platform's secrets manager (never bake into images). Audit `git log -p -- backend-node/.env`; if ever tracked, rotate + history cleanup.

---

## 3. Pending High Priority Issues

### P-H1 — Plaintext password fallback in login
- `authController.loginUser` still supports a legacy plaintext password path.
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §15 (#4); `SECURITY_FIX_REPORT.md` §4 (#3).
- **Fix:** Remove fallback; force bcrypt migration for any legacy records.

### P-H2 — AI service permissive CORS (`allow_origins=["*"]` with credentials)
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §15 (#5); `ai-service/app/main.py`.
- **Fix:** Restrict to internal/known origins for production.

### P-H3 — Socket.IO connections not authenticated at connect time
- Any client reaching the backend can listen to emitted events; some events emit globally.
- **Source:** H-4, S-9; `PROJECT_KNOWLEDGE_BASE.md` §15 (#6).
- **Fix:** Add per-connection/per-room auth check in `socket.js`.

### P-H4 — Upload size limit mismatch (backend 1024 MB vs AI service 50 MB)
- Backend `MAX_UPLOAD_SIZE_MB=1024` accepts files the AI service (`MAX_FILE_MB=50`) will refuse; memory-pressure/DoS surface.
- **Source:** Issue 6; S-5; `LOCAL_STACK_VERIFICATION_REPORT.md` §3.
- **Fix:** Align both to ~50 MB and enforce in upload middleware.

### P-H5 — `REMINDER_RUN_SECRET` not set in `.env`; not required at boot
- Endpoint is correctly closed today (returns 401 without secret), but the secret is absent and not enforced as a required env at startup.
- **Source:** S-3; `SECURITY_FIX_REPORT.md` §4 (#2); `LOCAL_STACK_VERIFICATION_REPORT.md` §9.
- **Fix:** Set the secret; make a missing secret a hard startup failure.

### P-H6 — Data-shape bug: `followupInvitationService` reads `firstName`/`lastName` but `User` model stores `fullName`
- Likely produces undefined doctor names in invitations.
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §16, §22.
- **Fix:** Read `fullName` consistently.

### P-H7 — Missing Mongo indexes on hot query paths
- `FollowUp`/`Appointment`/`Consultation` queries by doctor/date/status, and `Report` by `patientId`, lack indexes → table scans at scale.
- **Source:** S-10, H-12; `PROJECT_KNOWLEDGE_BASE.md` §8.
- **Fix:** Add schema-level indexes on the four models.

### P-H8 — Production CORS / `FRONTEND_URL` not locked
- `CORS_ORIGIN` is local-only; `FRONTEND_URL` not set.
- **Source:** S-8; `LOCAL_STACK_VERIFICATION_REPORT.md` §9 (#8).
- **Fix:** Set comma-separated prod origins and `FRONTEND_URL` before deploy.

---

## 4. Pending Medium Priority Issues

### P-M1 — Patient file upload lacks strict MIME allowlist / magic-byte validation
- Header-based MIME is spoofable; arbitrary types can land in `patient_files`.
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §15 (#8), H-7.

### P-M2 — Public appointment booking has no CAPTCHA / abuse protection
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §15 (#9).

### P-M3 — `FollowUps` and `Appointments` list endpoints not paginated
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §17.

### P-M4 — Super-admin language config is in-memory only (not persisted)
- UI/speech/default language updates do not survive restart.
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §7 (superAdminRoutes notes).

### P-M5 — AI `OPENAI_MODEL` env not honored by helpers (hardcoded `gpt-4.1-mini`)
- **Source:** H-3; `PROJECT_KNOWLEDGE_BASE.md` §11.

### P-M6 — In-memory reminder scheduling is not durable across restarts
- `setTimeout`-based scheduling can drift/fail after redeploy; no distributed lock.
- **Source:** H-6; `PROJECT_KNOWLEDGE_BASE.md` §6.

### P-M7 — AI service `/transcribe` reads entire upload into memory before temp write
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §12, §17.

### P-M8 — AI service `/health` exposes environment detail (Python/SDK/FFmpeg paths)
- Reconnaissance risk once publicly exposed.
- **Source:** S-7; `LOCAL_STACK_VERIFICATION_REPORT.md` §9 (#7).

### P-M9 — Suspected latent bug: `frontend/src/services/subscriptionService.ts` references `axios`/`AxiosResponse`/`API_ROOT`/`handleApiError` without visible imports
- **Source:** `PROJECT_KNOWLEDGE_BASE.md` §16, §22. Needs verification.

### P-M10 — `NODE_ENV` mismatch (AI service `production` vs backend `development`)
- Cosmetic locally; normalize before deploy.
- **Source:** `LOCAL_STACK_VERIFICATION_REPORT.md` §3 (#10).

---

## 5. UI/UX Remaining Improvements

- **UI-1** Mobile sidebar has no translucent backdrop / tap-outside-to-close (PRE-8, §5.3).
- **UI-2** Raw `bg-(blue|green|red|emerald|amber)-(\d00)` button colors bypass design tokens (F-011/F-012) — e.g. Appointments confirm/cancel, FollowUps send-reminder.
- **UI-3** Date formatting scattered across pages; no shared `utils/date.ts` (F-073).
- **UI-4** Oversized page components: `NewConsultation.tsx` (~1200 LOC), `PastConsultations.tsx` (~1150 LOC), `PatientDetail.tsx` (~800 LOC) (F-071, R-3/R-4).
- **UI-5** Icon-only buttons missing `aria-label` (PastConsultations, Reports, Dashboard row actions) (F-040).
- **UI-6** Form validation not centralized; adopt `react-hook-form` + `zod`; inline errors + disabled-while-submitting (F-030, §5.4).
- **UI-7** Design-system primitives not standardized (`card`, `h1/h2/h3`, `PageHeader`, `DataTable`, `FormField`) (§5.2, §14 of audit).
- **UI-8** Chart accessibility: no `role="img"`/`aria-label`/`sr-only` summary on Recharts (F-041).
- **UI-9** Other a11y: focus-ring utility (F-042), consistent `<label htmlFor>` (F-043), skip-to-content link (F-045), heading order on Pricing/Analytics (F-046).
- **UI-10** Pricing plan-card label/value concatenation reads oddly to screen readers (NEW-3, on-screen layout already correct).
- **UI-11** Urdu translations not authored (intentionally gated behind "coming soon").
- **UI-12** PDF generation shows no progress indicator on large reports; UI can freeze (F-064).
- **UI-13** Add tablet (768 px) and small-laptop (1024 px) breakpoints to QA; ensure Past Consultations table never clips actions <1280 px (§5.5).

---

## 6. AI Workflow Remaining Improvements

- **AI-1** Align `MAX_UPLOAD_SIZE_MB` (backend) with `MAX_FILE_MB` (AI service) to one realistic cap (also P-H4) (§6.1).
- **AI-2** Add magic-byte sniff (e.g. `file-type`) on backend upload (§6.1, H-7).
- **AI-3** Explicit per-stage timeout + retry budget recorded in `AiTask.metadata`; circuit breaker after N consecutive AI failures (H-1, §6.2).
- **AI-4** Resolve double-billing risk between AI-service Whisper and backend Whisper fallback — pick a single fallback owner (H-2, §6.3).
- **AI-5** Chunk long audio (>10 min) via FFmpeg before Whisper (§6.3).
- **AI-6** Centralize and version SOAP/analysis prompts (`prompts/` per service); log prompt version per task (R-7, §6.4/§6.7).
- **AI-7** Enforce strict JSON output (`response_format: json_object`) + schema validation (zod/pydantic) before render (§6.4).
- **AI-8** Honor `DEMO_MODE=true` so AI service does not hard-require `OPENAI_API_KEY` for offline demos (H-8, §6.6).
- **AI-9** `extract-followup` logic is simplistic; improve extraction quality (`PROJECT_KNOWLEDGE_BASE.md` §11).
- **AI-10** Replace `print`-based logging in AI service with structured logging (`PROJECT_KNOWLEDGE_BASE.md` §11).

---

## 7. Testing Remaining Work

- **No automated test suite exists** for backend, frontend, or AI service; no CI test config. Only ad hoc scripts (`ai-service/test_transcribe.py`, `transcribe_test.py`).
- **Backend (Jest + supertest):** `auth`, `consultation` pipeline, `reminder` secret enforcement + idempotency, `twilioWebhook` signed-vs-unsigned (S-2 regression test), `subscription` (clean failure on empty `stripePriceId`), `patient` CRUD + role, `report` preview/save/PDF, `aiTaskService` stage retries (§9.2).
- **Frontend (Vitest + RTL):** `AuthContext` (429 keeps session / 401 wipes), `Login` (error + disabled submit), `Pricing` (label/value rows), `NewConsultation` (render + recorder-disabled-without-patient), `i18n` key-existence check (§9.3).
- **AI service (PyTest):** mocked Whisper transcribe shape, SOAP golden in/out, drug-safety empty/known-interaction, `/health` flags (§9.4).
- **End-to-end (Playwright):** login → patient → consultation → upload sample → "Transcribed" → report → PDF download (§9.5).
- **CI:** add `npm run build` + `npm run lint` + minimum tests on PR.

---

## 8. Deployment Remaining Work

- **DEP-1** Commit and re-verify all working-tree security/UI fixes on the deployable branch (CF-1…CF-10 currently live in working tree; `main` may still be in the pre-fix state) (S-1, §10.1).
- **DEP-2** Rotate all secrets and move them to a secrets manager — not `.env` in the image (P-C2, §10.1).
- **DEP-3** Seed `subscriptionplans` in production DB; verify Stripe price IDs and a test-mode checkout (P-C1, §10.1).
- **DEP-4** Migrate `uploads/audio` and `uploads/reports` from local disk to S3-compatible object storage (required before horizontal scaling) (§10.3).
- **DEP-5** Lock `CORS_ORIGIN` to prod frontend + set `FRONTEND_URL` (P-H8); align upload limits to 50 MB (P-H4).
- **DEP-6** MongoDB Atlas (or managed) with auth, IP allowlist, daily backups (§10.2).
- **DEP-7** Keep AI service on internal network (not publicly exposed); trim `/health` env detail in production (P-M8).
- **DEP-8** Public HTTPS URLs configured for Stripe and Twilio webhooks; `TWILIO_WEBHOOK_URL` must match exactly (CF-2 remaining-risk note).
- **DEP-9** Verify all three Docker images build (`docker-compose config`, `docker build`); ensure FFmpeg present in AI image (§10).
- **DEP-10** FYP demo: seed a demo doctor + 2 patients + 1 completed consultation + 1 SOAP report (offline fallback, no live OpenAI dependency) (`NEXT_IMPLEMENTATION_SESSIONS.md` Session 5; rescue plan Session 7).

---

## 9. Files Safe to Remove Later

> Do **not** delete now — listed for a future, approved cleanup pass.

| Item | Why | Suggested future action |
|---|---|---|
| `temp_diff.txt` | Scratch artifact already committed to history | `git rm --cached` + add to `.gitignore` |
| `ai-service/temp_transcribe_test.wav` | Test audio artifact in history | `git rm --cached` + `.gitignore` |
| `ai-service/test_transcribe.py`, `ai-service/transcribe_test.py` | Ad hoc manual scripts, not structured tests | Replace with PyTest suite, then remove |
| `backend-legacy/` | Deprecated Flask monolith; port-5000 footgun | Keep as reference until Node stack fully stable, then archive/remove |
| root `ApiError.js` | Duplicates `backend-node/src/utils/ApiError.js` | Verify unused, then remove |
| `frontend/src/pages/_archive/EditPatient.tsx` | Archived orphan (replaced by `PatientEdit.tsx`) | Remove after a release of confidence |
| `frontend/src/i18n/locales/legacy/en.json`, `ur.json` | Archived legacy locale tree (not imported) | Remove once Urdu strategy decided |
| `frontend/dist/**` | Build output (untracked) | Keep `.gitignore`d; safe to clear anytime |
| `qa-screenshots/**` (16 PNGs) | Synthetic QA evidence (~3.7 MB) | Optionally `.gitignore`; keep local |
| Report markdown files (`UI_UX_*`, `*_FIX_REPORT.md`, `*_CLEANUP_REPORT.md`, `GIT_CLEANUP_RECOMMENDATION.md`, `LOCAL_STACK_VERIFICATION_REPORT.md`, etc.) | Point-in-time handoff docs, now consolidated here | Move to a `docs/history/` folder after this tracker is accepted |
| `node_modules/`, `.venv/`, `uploads/` | Build/runtime, already gitignored | Exclude from any shared ZIP |
| local `.env` files | Contain secrets | Never share; exclude from ZIP; rotate (P-C2) |

---

## 10. Final Recommended Order (next 10 tasks)

1. **Commit & verify the working-tree security/UI fixes** on the deployable branch (separate security, frontend, tooling, docs commits — no rebase/force-push). Re-test: `/api/test/openai` → 401, `/api/reminders/run` → 401, unsigned Twilio webhook → 403. (DEP-1)
2. **Rotate all secrets** (`JWT_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `SUPER_ADMIN_PASSWORD`) and move to a secrets manager. (P-C2)
3. **Seed Stripe plans + verify test-mode checkout**; hide paid CTAs behind a flag until seeded. (P-C1)
4. **Set `REMINDER_RUN_SECRET` and enforce it as a required env at boot.** (P-H5)
5. **Align `MAX_UPLOAD_SIZE_MB=50` end-to-end** (backend + AI service) and enforce in upload middleware. (P-H4)
6. **Remove the plaintext password fallback** in `authController.loginUser`. (P-H1)
7. **Fix the `firstName`/`lastName` vs `fullName` mismatch** in `followupInvitationService`. (P-H6)
8. **Tighten CORS:** lock backend `CORS_ORIGIN`/`FRONTEND_URL` to prod host; restrict AI service `allow_origins`; trim AI `/health` detail in prod. (P-H8, P-H2, P-M8)
9. **Add Mongo indexes** for FollowUp/Appointment/Consultation hot queries and `Report.patientId`. (P-H7)
10. **Land the minimum test suite + CI** (auth, reminder-secret, Twilio webhook regression, i18n key-existence) and **seed the FYP demo doctor** for an offline demo fallback. (§7, DEP-10)

---
*End of tracker.*
