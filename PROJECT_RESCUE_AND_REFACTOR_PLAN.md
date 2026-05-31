# Project Rescue and Refactor Plan

**Project:** Clinix.ai
**Root:** `D:\clinixai-stage`
**Date:** 2026-05-31
**Author:** Senior architect / QA / UI-UX / AI-workflow audit pass
**Mode:** **Read-only analysis. No source code was modified, no files were deleted, nothing was committed.**

Sources of truth consulted:
[README.md](README.md), [PROJECT_KNOWLEDGE_BASE.md](PROJECT_KNOWLEDGE_BASE.md), [LOCAL_STACK_VERIFICATION_REPORT.md](LOCAL_STACK_VERIFICATION_REPORT.md), [UI_UX_AUDIT_REPORT.md](UI_UX_AUDIT_REPORT.md), [UI_UX_FIX_REPORT.md](UI_UX_FIX_REPORT.md), [UI_UX_SECOND_FIX_REPORT.md](UI_UX_SECOND_FIX_REPORT.md), [FRONTEND_UI_QA_REPORT.md](FRONTEND_UI_QA_REPORT.md), [SECURITY_FIX_REPORT.md](SECURITY_FIX_REPORT.md), live `git status`, `git log`, code/dir surveys.

---

## 1. Executive Summary

**Overall project health rating: 6 / 10.**

Clinix.ai is functionally rich and the local stack runs end-to-end: frontend ↔ backend ↔ AI service ↔ MongoDB ↔ OpenAI all respond and the consultation → transcription → SOAP → report flow is implemented in code. After the two UI/UX passes and the security fixes already on `my-working-code`, no user-facing screen is broken or blank, and the most dangerous public endpoints have been hardened in the working tree.

What still holds it back from being "production-ready":

- **Subscription billing is not actually wired.** `subscriptionplans` collection is empty (0 docs), the public `/api/subscription/plans` is serving an in-code fallback with **blank `stripePriceId`**, so any real checkout flow will fail. Stripe webhook + plan seeding are unverified.
- **The new security hardening exists only as uncommitted edits** in 5 backend controllers/routes (see §2). It is real, but until it is committed and re-verified, the deployable branch (`main`) is still in the original unsafe state.
- **Two large pages (`NewConsultation.tsx` 1209 lines, `PastConsultations.tsx` 1151 lines) and one duplicated page pair (`EditPatient.tsx` ↔ `PatientEdit.tsx`)** carry the bulk of the technical debt and most likely future regressions.
- **i18n has two parallel locale trees** (`frontend/src/i18n/locales/en.json` from the old wiring and `frontend/src/locales/en/translation.json` from the Phase-2 fix). Only the second is loaded; the first is stale and must be retired.
- **`backend-legacy/` Flask app is still in the repo** and uses the same port (5000). It is not started by `start-local.ps1` and not in `docker-compose.yml`, but it is a footgun for new contributors.
- **No automated tests.** A handful of `test_openai.py` / `transcribe_test.py` scratch scripts exist; there is no Jest/Vitest/PyTest suite covering auth, controllers, services, or the AI workflow.

**Can it be used for the FYP demo?** **Yes**, with the §12 "Top 5 must-fix before FYP demo" list completed (≈ 1 short focused session). The demo path — login → patient → consultation → audio upload → transcription → SOAP report → PDF — already works on the local stack.

**Can it be deployed now?** **No.** Deployment blockers in priority order: (1) commit and verify the security hardening already in the working tree; (2) seed real Stripe plans and verify a test-mode checkout; (3) lock down CORS / `FRONTEND_URL`; (4) align upload size limits; (5) rotate any secrets that have ever been committed. See §10.

**Biggest risks (single-sentence each):**
1. The uncommitted security patch is the only thing protecting `/api/reminders/run` and `/api/test/openai` — losing the working tree loses the fix.
2. Stripe price IDs are blank; any user who reaches the "Get started" button on `/pricing` will hit a checkout error.
3. `NewConsultation.tsx` and the consultation → AI task → report chain has no automated test, and a 1200-line component with mixed state + side-effects is the single most likely place a demo will break.
4. Twilio sandbox sender and reminder worker are configured but unmetered — an accidental seed + reminder run could send real WhatsApp messages.
5. `OPENAI_API_KEY`, `JWT_SECRET`, `SUPER_ADMIN_PASSWORD`, `STRIPE_SECRET_KEY` are all sitting in checked-in-adjacent `.env` files; if the repo was ever pushed publicly, these are compromised.

---

## 2. Current Git State

- **Current branch:** `my-working-code` (HEAD = `b355d05`)
- **Diverges from `main` (`60982e7`):** by 4 commits, with substantial backend/frontend additions already merged in.
- **Working tree:** 8 modified files, 5 untracked entries.
- **Conflict markers:** none detected.

### 2.1 Files changed grouped by category

**A. Frontend UI/UX fixes (this assistant, Phase 2 + Phase 3):**
- [frontend/src/components/layout/Header.tsx](frontend/src/components/layout/Header.tsx) — 3 new route entries for `/analytics`, `/follow-ups`, `/appointments`.
- [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx) — `isTokenValid` no longer wipes session on 429 / network errors (Phase 2 second-pass fix).

**B. Backend security hardening (uncommitted, the most important deltas in the tree):**
- [backend-node/src/controllers/consultationController.js](backend-node/src/controllers/consultationController.js)
- [backend-node/src/controllers/reminderController.js](backend-node/src/controllers/reminderController.js)
- [backend-node/src/controllers/twilioWebhookController.js](backend-node/src/controllers/twilioWebhookController.js)
- [backend-node/src/routes/aiRoutes.js](backend-node/src/routes/aiRoutes.js)
- [backend-node/src/routes/testRoutes.js](backend-node/src/routes/testRoutes.js)

**C. Tooling:**
- [start-local.ps1](start-local.ps1) — 76 line additions to the local-stack starter.

**D. Untracked documentation / artefacts (safe to add, but do **not** commit `qa-screenshots/` to public history if they contain real patient data — current set is synthetic, so fine):**
- [FRONTEND_UI_QA_REPORT.md](FRONTEND_UI_QA_REPORT.md)
- [UI_UX_AUDIT_REPORT.md](UI_UX_AUDIT_REPORT.md)
- [UI_UX_FIX_REPORT.md](UI_UX_FIX_REPORT.md)
- [UI_UX_SECOND_FIX_REPORT.md](UI_UX_SECOND_FIX_REPORT.md)
- `qa-screenshots/` (16 PNGs, ~3.5 MB)

**E. Files this analysis pass added** (this single file): `PROJECT_RESCUE_AND_REFACTOR_PLAN.md`.

### 2.2 What should be committed now, reviewed, or held back

| Bucket | Files | Action |
|---|---|---|
| Commit immediately as one security commit | B (5 backend files) | Most important — keeps the rate-limit / signature-verification / auth-gating from being lost. |
| Commit as one UI follow-up | A (2 frontend files) | Small, well-scoped; pairs with `UI_UX_SECOND_FIX_REPORT.md`. |
| Commit as docs | D (4 reports + this file) | Use a separate `docs:` commit. Skip `qa-screenshots/` from public push if uncertain — keep locally or under `.gitignore`. |
| Review before commit | C ([start-local.ps1](start-local.ps1)) | 76-line addition warrants a 2-minute diff read; if it only adds env / port / FFmpeg checks, commit as `chore:`. |
| Do not commit | `temp_diff.txt`, `ai-service/temp_transcribe_test.wav`, any `*.env`, any real patient screenshots | Add to `.gitignore` if not already. |

### 2.3 Recommended commit sequence (3 commits, no rebase, no force-push)

1. `fix(security): protect reminder/test/twilio webhook/ai endpoints` — files in bucket B.
2. `fix(frontend): preserve session on 429; add page headers for analytics/follow-ups/appointments` — files in bucket A.
3. `docs: add UI/UX audit, fix reports and rescue plan` — bucket D + this file.

**Do not** combine A + B in one commit (mixes attack surface with cosmetic UI). **Do not** rebase or force-push — `my-working-code` has already been published.

---

## 3. Confirmed Critical Issues

Each is reproducible today.

### C-1 — Stripe checkout is wired to a fallback price list with empty `stripePriceId`
- **Severity:** Critical (business-blocking)
- **Evidence:** [LOCAL_STACK_VERIFICATION_REPORT.md](LOCAL_STACK_VERIFICATION_REPORT.md) §7 — `subscriptionplans` count = 0; `/api/subscription/plans` returns fallback with `stripePriceId: ""`.
- **File/path:** `backend-node/src/services/...` (plan list) + [seed-stripe-plans.js](backend-node/seed-stripe-plans.js)
- **Risk:** Every paid sign-up fails at "Get started".
- **Smallest safe fix:** Run `npm run seed:stripe` against the Stripe **test** dashboard, then confirm `subscriptionplans.find()` returns docs with non-empty `stripePriceId`. Until then, hide the paid plan CTAs behind a feature flag.

### C-2 — Public `/api/test/openai` and `/api/reminders/run` burn real quota / send real messages
- **Severity:** Critical (still Critical on `main`; **fixed in working tree, not yet committed**)
- **Evidence:** [LOCAL_STACK_VERIFICATION_REPORT.md](LOCAL_STACK_VERIFICATION_REPORT.md) §10, [SECURITY_FIX_REPORT.md](SECURITY_FIX_REPORT.md). Confirmed live: both returned 200 unauthenticated.
- **File/path:** [backend-node/src/routes/testRoutes.js](backend-node/src/routes/testRoutes.js), [backend-node/src/controllers/reminderController.js](backend-node/src/controllers/reminderController.js).
- **Risk:** Quota drain, accidental WhatsApp send-out.
- **Smallest safe fix:** Commit bucket B (§2). Then verify with the smoke commands in §9.

### C-3 — Twilio webhook accepts unsigned requests
- **Severity:** Critical (same — fixed in working tree, not committed)
- **Evidence:** Unsigned POST to `/api/webhooks/twilio/whatsapp` returned `200 <Response></Response>`.
- **File/path:** [backend-node/src/controllers/twilioWebhookController.js](backend-node/src/controllers/twilioWebhookController.js)
- **Risk:** Forged confirm/decline events mutate `Appointment` / create `FollowUp` records.
- **Smallest safe fix:** Confirm the working-tree edit uses `twilio.validateRequest(authToken, signature, url, params)`; commit; re-test with a malformed signature → expect 403.

### C-4 — `JWT_SECRET`, `OPENAI_API_KEY`, `SUPER_ADMIN_PASSWORD`, `STRIPE_SECRET_KEY` live in `.env` next to the repo
- **Severity:** Critical (always — independent of git ignore)
- **Evidence:** [PROJECT_KNOWLEDGE_BASE.md](PROJECT_KNOWLEDGE_BASE.md) §5; [LOCAL_STACK_VERIFICATION_REPORT.md](LOCAL_STACK_VERIFICATION_REPORT.md) §9 finding 9.
- **Risk:** If this repo has ever been pushed publicly or shared, all four are compromised.
- **Smallest safe fix:** Treat as rotated: regenerate JWT_SECRET (forces user re-login — acceptable), regenerate OpenAI key, regenerate Stripe key, change super-admin password, then update local `.env`. Add a `git log -p -- backend-node/.env` audit pass — if `.env` was ever tracked, **rotate immediately** and consider a `git filter-repo` cleanup.

### C-5 — `AuthContext.isTokenValid` formerly signed out the user on any error
- **Severity:** Critical UX bug (**fixed in working tree, not committed**)
- **Evidence:** [FRONTEND_UI_QA_REPORT.md](FRONTEND_UI_QA_REPORT.md) §5 NEW-1; reproduced live (4× 429 → forced logout).
- **File/path:** [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx)
- **Risk:** Demo session looks broken under any rate limiter spike.
- **Smallest safe fix:** Commit bucket A.

### C-6 — Auth rate limit (5 req / 15 min) covers `/auth/validate-token`
- **Severity:** High (backend; documented, **not** fixed)
- **Evidence:** [backend-node/src/app.js](backend-node/src/app.js#L89-L91); reproduced live during QA.
- **File/path:** [backend-node/src/app.js](backend-node/src/app.js)
- **Risk:** Even with C-5 fixed, repeated refresh in production will throttle real users.
- **Smallest safe fix:** Move `/auth/validate-token` out from under the strict limiter (it is a GET, not a credential-burning endpoint) — either skip it in the limiter or apply a per-route limiter with `max: 60, windowMs: 60_000`. **Backend change — requires your approval.**

### C-7 — Two duplicate Patient-edit pages
- **Severity:** High (correctness; both wired in routes will eventually diverge)
- **Evidence:** [frontend/src/pages/EditPatient.tsx](frontend/src/pages/EditPatient.tsx) (467 lines) and [frontend/src/pages/PatientEdit.tsx](frontend/src/pages/PatientEdit.tsx) (477 lines).
- **Risk:** Bug fixes applied to one path will silently miss the other; users follow whichever the router resolves first.
- **Smallest safe fix:** Identify which is referenced in [frontend/src/App.tsx](frontend/src/App.tsx); delete the orphan in a separate review-able commit.

### C-8 — Two parallel i18n locale trees
- **Severity:** High (defensive)
- **Evidence:** `frontend/src/i18n/locales/en.json` (legacy, 650+ keys) and `frontend/src/locales/en/translation.json` (new, the only one wired through [frontend/src/i18n/index.ts](frontend/src/i18n/index.ts)).
- **Risk:** Reviewers will edit the wrong file; the legacy file may be re-imported by accident.
- **Smallest safe fix:** Confirm nothing imports `i18n/locales/en.json`; move it under `frontend/src/i18n/locales/legacy/` or delete in a tracked commit.

---

## 4. Hidden / Suspected Issues

These are inferred from code structure and were not directly reproduced.

| # | Area | Suspected issue | Why suspected |
|---|---|---|---|
| H-1 | AI workflow | Long-audio (>5 min) transcriptions may time out at the backend → AI service hop without retry. | `pythonService.js` + `aiTaskService.js` exist; no obvious circuit breaker; AI `MAX_FILE_MB=50` < backend `MAX_UPLOAD_SIZE_MB=1024`. |
| H-2 | AI workflow | Whisper fallback (`openaiWhisperService.js`) may double-bill: backend retries with OpenAI if FastAPI fails, but caller may also retry. | Two independent transcription services in backend (`openaiWhisperService`, `pythonService`). |
| H-3 | AI workflow | SOAP prompts hardcode `gpt-4.1-mini` in helpers while `.env` sets `gpt-4o-mini` — model split. | Noted in [PROJECT_KNOWLEDGE_BASE.md](PROJECT_KNOWLEDGE_BASE.md) §5 footnote. |
| H-4 | Socket.IO | No documented CORS / auth on the socket layer; payloads may leak across roles. | `server.js` mounts socket.io; no per-room authorization visible. |
| H-5 | Reports | PDF generation streams from PDFKit and **also** writes to disk — race on long requests. | `generateConsultationReportPdf` flow described in KB §6. |
| H-6 | Followup worker | Reminder worker can run multiple times if redeployed; idempotency relies on `sentAt` flags. | `followupReminderWorker.js` exists; no distributed lock. |
| H-7 | Upload validation | Multer disk storage allows MIME from header — easy to spoof. | KB §6 says "MIME allowlist", not "magic-byte check". |
| H-8 | Demo mode | `DEMO_MODE=false` everywhere, but the AI service `main.py` startup **hard-fails** without `OPENAI_API_KEY` regardless of `DEMO_MODE`. | KB §5 footnote. |
| H-9 | Error boundaries | Only [frontend/src/components/ErrorBoundary.tsx](frontend/src/components/ErrorBoundary.tsx) exists; not wired around the heavy `NewConsultation.tsx`. | File present but no usage check in App shell. |
| H-10 | Large components | `NewConsultation.tsx` 1209 lines, `PastConsultations.tsx` 1151 lines — high probability of stale-closure / effect-dependency bugs. | Sheer size + lint debt concentrated here. |
| H-11 | Backend-legacy | Flask app still in repo; risk of someone running it on port 5000 and silently shadowing the real backend. | KB §3 explicitly flags it. |
| H-12 | Mongo indexes | None documented; queries like `FollowUp.find({ doctorId, scheduledAt: { $gte } })` will table-scan at scale. | No `index.js` or schema-level `index({...})` mentioned. |
| H-13 | Frontend services duplication | `services/agentService.ts`, `analyticsService.ts`, `apiFetch.ts` + 9 others — likely repeated `axios.create` boilerplate and auth header injection. | Mirror of backend service shape; not consolidated. |

---

## 5. UI / UX Improvement Plan

### 5.1 Quick polish (1 short session, fully reversible)
- Replace `t('superAdmin.transcriptions')` + `{n}/{t('superAdmin.month')}` rows on `/pricing` with a single `Trans` component or explicit `{label}: {value}` to remove visual concatenation.
- Map `consultation.type` enums (`general`, `follow_up`, `initial`) through `t()` on `/past-consultations`.
- Add `whitespace-nowrap` to remaining 4–5 table `<th>` cells (Reports, Past Consultations) — same fix that worked on Dashboard.
- Replace 🇺🇸 emoji in language picker with a 2-letter pill ("EN") to avoid the Windows-Chromium "us" rendering.

### 5.2 Design-system cleanup (medium session)
- Audit (do not yet refactor) all `bg-(blue|green|red|emerald|amber)-(\d00)` usages. Audit-only output → table of files. Apply `btn-primary` / `btn-secondary` / `btn-danger` mapping in a follow-up.
- Define `h1/h2/h3` and `card` utility classes in [frontend/src/index.css](frontend/src/index.css). Adopt page-by-page.
- Retire `frontend/src/i18n/locales/en.json` (legacy tree).

### 5.3 Layout / sidebar / header
- Add proper tooltips for collapsed sidebar (use a minimal hand-rolled tooltip; do not add Radix as a dependency unless approved).
- Add `DocumentHeader` component (or just keep using the central `Header.tsx` route table) for any new routes added after `/analytics`, `/follow-ups`, `/appointments`.
- Mobile sidebar: add a translucent backdrop and "tap outside to close" (pre-existing PRE-8).

### 5.4 Form / input validation
- Add inline error rendering for the four most common forms: Login, Register, Patient create/edit, Consultation create.
- Disable submit buttons while pending.
- Add file-size + MIME hint under audio uploader (the hint was added behind consent gate in Phase 2; surface it always).

### 5.5 Mobile / responsive
- Add 2 more breakpoints to QA list: 768 px (tablet) and 1024 px (small laptop). Mobile (375) is already clean.
- `/past-consultations`: enable horizontal scroll on the table container at <1280 px so the actions column never clips.

### 5.6 Accessibility
- Add `aria-label` to every icon-only button (top-bar search, sidebar toggle, language picker).
- Ensure all form fields have an associated `<label htmlFor>` (currently mixed).
- Verify contrast for the secondary text on dark sidebar (`text-slate-400` on `bg-slate-900` is borderline).

---

## 6. AI Workflow Improvement Plan

### 6.1 Audio upload
- **Confirm:** flow in [PROJECT_KNOWLEDGE_BASE.md](PROJECT_KNOWLEDGE_BASE.md) §6 is consistent with code.
- **Improve:** align `MAX_UPLOAD_SIZE_MB` (backend) with `MAX_FILE_MB` (AI service) — pick 50 MB.
- **Improve:** add magic-byte sniff (`file-type` package, ~5 KB) on the backend.

### 6.2 AI task orchestration
- **Confirm:** `aiTaskService` queues, persists, and resumes on startup (`server.js` resumes pending tasks).
- **Improve:** explicit timeout + retry budget per stage (transcription / analysis / SOAP) recorded in `AiTask.metadata`.
- **Improve:** circuit breaker — after N consecutive AI service failures, fail-fast for X minutes.

### 6.3 Transcription
- **Confirm:** primary path is AI service FastAPI → OpenAI Whisper; backend has Whisper fallback.
- **Improve:** decide one owner of fallback to remove double-billing risk (H-2). Recommended: AI service owns fallback, backend never calls OpenAI directly for transcription.
- **Improve:** chunk long audio (>10 min) at the AI service via FFmpeg before Whisper.

### 6.4 SOAP / report generation
- **Confirm:** prompts live in `openaiService.js` and `ai-service/app/services/soap_note_service.py`.
- **Improve:** centralize prompt strings in one constants file per service; version them (`SOAP_PROMPT_V2 = "..."`); log version with each AI task.
- **Improve:** strict JSON output (`response_format: { type: "json_object" }`) and validate with a zod / pydantic schema before rendering.

### 6.5 Error handling / retry
- Per-stage retry with exponential backoff + jitter (already present? unverified — H-1).
- User-visible status messages in [NewConsultation.tsx](frontend/src/pages/NewConsultation.tsx) for "Whisper rate-limited, retrying in Xs".

### 6.6 Demo mode vs real mode
- AI service must honour `DEMO_MODE=true` and **not** require `OPENAI_API_KEY` (H-8) so FYP demos can run offline if the API key is missing.
- Add a single "Demo doctor" account with prebuilt consultations / transcripts / reports for instant demo.

### 6.7 Prompt quality
- Add a `prompts/` folder per service with one file per use case.
- Add 5 golden-input / golden-output snapshot tests per prompt (see §9).

### 6.8 Testing
- Smallest first: 3 PyTest cases on `ai_service.py` that mock OpenAI and assert the SOAP shape.
- Then: 3 Jest cases on `aiTaskService.js` covering "transcription fails → task marked failed" and "transcription ok → analysis stage starts".

---

## 7. Backend / Security Improvement Plan (prioritized)

| # | Fix | Why | File |
|---|---|---|---|
| S-1 | Commit the working-tree security patch (bucket B) | All four Critical/High exploits in §3 are mitigated by it. | 5 files in §2 bucket B |
| S-2 | Add Twilio signature verification regression test | Prevent C-3 from reappearing. | `backend-node/tests/twilioWebhook.test.js` (new) |
| S-3 | Enforce `REMINDER_RUN_SECRET` as required env at boot | Make a missing secret a startup failure, not a silent open door. | [backend-node/src/config/env.js](backend-node/src/config/env.js) |
| S-4 | Skip / loosen rate limiter for `/auth/validate-token` (C-6) | Otherwise C-5 keeps reappearing as a UX bug. | [backend-node/src/app.js](backend-node/src/app.js) |
| S-5 | Tighten `MAX_UPLOAD_SIZE_MB` to 50 | Matches AI service, removes DoS surface. | `backend-node/.env`, [backend-node/src/middleware/upload.js](backend-node/src/middleware/upload.js) |
| S-6 | Require auth on `/api/ai/drug-safety` | Public route makes OpenAI calls. | [backend-node/src/routes/aiRoutes.js](backend-node/src/routes/aiRoutes.js) |
| S-7 | Strip env detail from AI service `/health` in production | Currently exposes Python, FFmpeg, SDK versions. | [ai-service/app/main.py](ai-service/app/main.py) |
| S-8 | Lock `FRONTEND_URL` + comma-separated `CORS_ORIGIN` for prod | Right now CORS_ORIGIN is local-only. | `backend-node/.env`, [backend-node/src/app.js](backend-node/src/app.js) |
| S-9 | Add per-room auth check in `socket.js` | H-4. | [backend-node/src/socket.js](backend-node/src/socket.js) |
| S-10 | Add Mongo indexes for FollowUp/Appointment/Consultation hot queries | H-12. | model files |
| S-11 | Add request-body size limit + payload sanitization on webhook routes | Prevent XML/HTML injection in TwiML response. | [backend-node/src/controllers/twilioWebhookController.js](backend-node/src/controllers/twilioWebhookController.js) |
| S-12 | Rotate all secrets per C-4 | One-time. | env-only |

---

## 8. Code Refactor Plan (small, safe, sequential)

Each task is a separate commit. None should exceed ~250 LOC delta.

| # | Task | Files | Out of scope (don't touch) |
|---|---|---|---|
| R-1 | Resolve duplicate Patient-edit page (C-7) | Inspect [App.tsx](frontend/src/App.tsx) router → delete the unused file; update imports | Form fields, validation logic |
| R-2 | Retire legacy locale file (C-8) | Move `frontend/src/i18n/locales/*.json` → `legacy/` | Translation values |
| R-3 | Extract `useConsultationRecorder()` hook from `NewConsultation.tsx` | New `frontend/src/hooks/useConsultationRecorder.ts` + replace in page | Server / API layer |
| R-4 | Extract `<TranscriptionEditor />` from `PastConsultations.tsx` | New component file | Backend transcription endpoints |
| R-5 | Extract `<PlanCard />` + `<FaqItem />` from `Pricing.tsx` | Components folder | Stripe logic |
| R-6 | Centralise `axios.create({ baseURL: '/api', headers: ... })` into one `apiClient` | [frontend/src/services/apiFetch.ts](frontend/src/services/apiFetch.ts) | Endpoint method bodies |
| R-7 | Move SOAP/analysis prompts to `backend-node/src/services/prompts/*.ts` | New files | Workflow orchestration |
| R-8 | Mark `backend-legacy/` as deprecated in its README + add a top-level "DO NOT START" banner | Read-only doc edit | Code |
| R-9 | Add `frontend/src/components/EmptyState.tsx` and use it on `/analytics`, `/follow-ups`, `/appointments` | New + 3 page edits | Charts library |
| R-10 | Add Mongo indexes (S-10) | 4 model files | Query shape |

---

## 9. Testing Plan

### 9.1 Manual QA checklist (10 min smoke before any merge)
1. `/login` → real backend, real password → land on `/`
2. `/` shows Dashboard tiles, no raw `t('…')`
3. `/patients` → create → edit → detail
4. `/new-consultation` → upload ≤30 s sample audio → confirm transcription progresses
5. Open generated report → preview → download PDF
6. `/pricing` → click "Get started" → check error if Stripe not seeded (expected today)
7. Refresh `/` 6× in 1 minute → user stays signed in (validates C-5 fix)
8. Log out → `/login`
9. POST `/api/test/openai` without token → expect 401 (validates C-2 fix)
10. POST `/api/reminders/run` without secret → expect 401 (validates C-2 fix)

### 9.2 Backend tests (start with these 8, Jest + supertest)
- `auth.test.js`: register → login → validate-token → 401 on tampered token.
- `consultation.test.js`: create → list → upload-audio → status transitions.
- `reminder.test.js`: secret enforced; idempotency.
- `twilioWebhook.test.js`: signed vs unsigned request.
- `subscription.test.js`: list plans; create-checkout fails cleanly when `stripePriceId` empty.
- `patient.test.js`: CRUD with role enforcement.
- `report.test.js`: preview save + PDF stream returns 200 with PDF magic bytes.
- `aiTaskService.test.js`: each stage retried at most N times.

### 9.3 Frontend tests (Vitest + React Testing Library, start with 5)
- `AuthContext.test.tsx`: 429 keeps session, 401 wipes session.
- `Login.test.tsx`: error message rendered, button disabled while submitting.
- `Pricing.test.tsx`: plan rows render with expected label/value pairs.
- `NewConsultation.test.tsx`: at least the static render + recorder-button-disabled-without-patient case.
- `i18n.test.ts`: every key referenced via `t('…')` exists in `translation.json` (use a small grep helper).

### 9.4 AI service tests (PyTest, start with 4)
- `test_transcribe.py` upgrade: mock OpenAI Whisper, assert response shape.
- `test_soap_note_service.py`: golden in/out fixture; assert required SOAP sections present.
- `test_drug_safety_service.py`: empty input → empty arrays; one known interaction returns warning.
- `test_main_health.py`: `/health` returns required boolean flags.

### 9.5 End-to-end (Playwright, already in browser tooling)
- One happy-path script: login → patient → consultation → upload bundled sample → wait for "Transcribed" → open report → assert PDF download header.

### 9.6 What to run before deployment
- All of 9.2 + 9.3 + 9.4 green.
- Manual checklist 9.1 against a staging instance with real Stripe test keys.

### 9.7 What to run before FYP demo
- Manual checklist 9.1 only.
- Pre-seed: 1 demo doctor, 2 patients, 1 completed consultation with SOAP report (so a fallback story exists if live transcription fails on stage).

---

## 10. Deployment Plan

### 10.1 Minimum deployment-ready requirements
1. Bucket B security commit landed and re-verified (§9.1 items 9–10).
2. `REMINDER_RUN_SECRET`, `JWT_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `MONGODB_URI` all rotated and set in the hosting platform secrets manager — **not** in a `.env` file in the image.
3. `CORS_ORIGIN` = production frontend URL only; `FRONTEND_URL` set.
4. `MAX_UPLOAD_SIZE_MB` = 50; AI service `MAX_FILE_MB` = 50.
5. `subscriptionplans` seeded in the production DB; Stripe price IDs verified.
6. MongoDB hosted (Atlas or equivalent) with auth + IP allowlist.
7. AI service `OPENAI_API_KEY` set; AI service `/health` reachable from backend only (internal network).
8. Backend container exposes only `:5000`; AI service container not publicly exposed.
9. Nginx (already in [frontend/nginx.conf](frontend/nginx.conf)) handles `/api/*` proxy + HTTPS termination.

### 10.2 Recommended architecture
- Frontend: static build behind a CDN or Nginx.
- Backend: single Node container; horizontally scalable; uses S3-compatible object storage for `uploads/` (current local-disk strategy will not survive a redeploy).
- AI service: single Python container; behind internal network; autoscaling on CPU.
- MongoDB: Atlas M10+ with daily backup.
- Twilio + Stripe: production keys + webhook URLs pointing at the prod backend.

### 10.3 Blockers (must clear before pushing to prod)
- C-1, C-2, C-3, C-4 from §3.
- Storage migration: current `uploads/audio` and `uploads/reports` are written to local disk; **must** move to object storage before any horizontal scaling.
- No CI pipeline today; introduce at least `npm run build` + `npm run lint` + the §9.2/9.3 minimum tests on PR.

### 10.4 Env checklist (deployment)
- **Backend:** `PORT`, `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `FRONTEND_URL`, `PYTHON_AI_SERVICE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_WHISPER_MODEL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `MAX_UPLOAD_SIZE_MB=50`, `REMINDER_RUN_SECRET`, `SUPER_ADMIN_EMAIL/PASSWORD/FULL_NAME` (consider removing after first boot).
- **AI service:** `AI_SERVICE_PORT=8001`, `AI_SERVICE_HOST=0.0.0.0`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `MAX_FILE_MB=50`, `RXNORM_API_ID`.
- **Frontend:** `VITE_API_URL=https://<prod-api-host>`.

---

## 11. Cursor Implementation Roadmap

Seven small, scoped sessions. Each is designed to be runnable independently in a fresh editor.

### Session 1 — Git cleanup and commit structure
- **Goal:** Convert the dirty working tree into 3 clean commits per §2.3.
- **Files allowed:** all files already in `git status`.
- **Files not allowed:** anything not in `git status`.
- **Commands to run:** `git status`, `git diff`, `git add -p`, `git commit -m`, `git log --oneline -n 5`.
- **Tests to run:** none.
- **Expected output:** 3 new commits on `my-working-code`; no untracked source files; reports tracked.
- **Stop conditions:** any merge conflict; any `git push` request.

### Session 2 — Critical security fixes verification
- **Goal:** Verify §3 fixes are live by re-running §9.1 items 9–10 plus a malformed-Twilio-signature POST.
- **Files allowed:** none (read-only run).
- **Files not allowed:** all source.
- **Commands:** `Invoke-WebRequest http://localhost:5000/api/test/openai` → expect 401; `Invoke-WebRequest -Method POST http://localhost:5000/api/reminders/run` → expect 401; signed-vs-unsigned Twilio webhook.
- **Tests:** §9.2 `reminder.test.js` + `twilioWebhook.test.js` if already written.
- **Expected output:** all three return the secure status code.
- **Stop:** any 200 on an unauthenticated security-sensitive endpoint.

### Session 3 — UI / design-system cleanup
- **Goal:** §5.1 quick polish + §5.2 retire legacy locale file (C-8) + R-9 EmptyState.
- **Files allowed:** anything under `frontend/src/**` plus `frontend/src/index.css`.
- **Files not allowed:** `backend-node/**`, `ai-service/**`, any `.env*`.
- **Commands:** `npm run build`, `npm run lint -- --max-warnings 19`.
- **Tests:** none new; visual recheck of `/pricing`, `/past-consultations`, `/analytics`.
- **Expected output:** build green; lint count not worse than baseline.
- **Stop:** any new lint error in a file you did not touch.

### Session 4 — AI workflow debugging
- **Goal:** Verify §6.1–§6.4 against the running stack; record findings; do not refactor.
- **Files allowed:** read-only across `backend-node/src/services/**` + `ai-service/app/services/**`.
- **Files not allowed:** any write to source.
- **Commands:** create a tiny WAV (≤5 s), POST through `/api/consultations/:id/upload-audio` with a real token, watch `AiTask` in Mongo.
- **Tests:** none yet; capture timings.
- **Expected output:** a one-pager AI_WORKFLOW_FINDINGS.md (markdown only) listing observed retry / timeout behaviour.
- **Stop:** any real OpenAI cost > $0.10.

### Session 5 — Testing
- **Goal:** Land §9.2 first 3 backend tests + §9.3 first 2 frontend tests + §9.4 first 2 AI service tests.
- **Files allowed:** `*/tests/**`, `*.test.{js,ts,tsx,py}`, `package.json` (script lines only), `pytest.ini`.
- **Files not allowed:** any production source.
- **Commands:** `npm test` (after adding script), `pytest ai-service`.
- **Expected output:** 7 green tests; CI-runnable.
- **Stop:** adding a new runtime dependency.

### Session 6 — Deployment prep
- **Goal:** §10.1 items 1–4 only.
- **Files allowed:** `Dockerfile`s, `nginx.conf`, `docker-compose.yml`, `.env.example` files, this rescue plan.
- **Files not allowed:** any real `.env`, any controller / page / service.
- **Commands:** `docker-compose config`, `docker build` for each service.
- **Expected output:** all three images build; example env file lists every required key from §10.4.
- **Stop:** any real secret printed to console.

### Session 7 — FYP demo polish
- **Goal:** §12 "must-fix before FYP demo" list; seed demo doctor + 2 patients + 1 completed consultation.
- **Files allowed:** a single new seed script `scripts/seed-demo.js` + read-only of the rest.
- **Files not allowed:** any controller or page.
- **Commands:** `node scripts/seed-demo.js` against the demo DB.
- **Tests:** §9.1 happy path.
- **Expected output:** Demo doctor logs in and reaches a pre-baked completed report in ≤90 seconds with no live OpenAI dependency.
- **Stop:** any change to authentication or pricing logic.

---

## 12. Final Priority List (top 20, exact order)

1. **Commit the working-tree security patch** (bucket B — closes C-2, C-3 on the deployed branch).
2. **Commit the working-tree UI patch** (bucket A — closes C-5 + page-header gap).
3. **Rotate `JWT_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`, `SUPER_ADMIN_PASSWORD`** (C-4).
4. **Seed Stripe plans + verify checkout in Stripe test mode** (C-1).
5. **Skip / loosen rate-limit for `GET /auth/validate-token`** (C-6).
6. **Align `MAX_UPLOAD_SIZE_MB=50` end-to-end** (S-5).
7. **Resolve duplicate `EditPatient.tsx` vs `PatientEdit.tsx`** (C-7, R-1).
8. **Retire `frontend/src/i18n/locales/en.json` legacy tree** (C-8, R-2).
9. **Require auth on `/api/ai/drug-safety`** (S-6).
10. **Add Twilio signature regression test** (S-2).
11. **Strip env detail from AI `/health` in production** (S-7).
12. **Lock `CORS_ORIGIN` + `FRONTEND_URL` to prod host** (S-8).
13. **Add Mongo indexes for FollowUp / Appointment / Consultation hot queries** (S-10).
14. **Centralise prompts in `backend-node/src/services/prompts/`** (R-7).
15. **Extract `useConsultationRecorder()` hook from `NewConsultation.tsx`** (R-3).
16. **Extract `<TranscriptionEditor />` from `PastConsultations.tsx`** (R-4).
17. **Add `EmptyState` component + use on /analytics, /follow-ups, /appointments** (R-9).
18. **Migrate `uploads/*` to object storage** (deployment blocker, §10.3).
19. **Add CI: `npm run build` + `npm run lint` + minimum §9.2/§9.3/§9.4 tests on PR**.
20. **Add Playwright happy-path e2e + bake the demo-doctor seed script** (Session 7).

---
*End of plan.*
