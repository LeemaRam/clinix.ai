# Next Implementation Sessions — Clinix.ai

**Project:** Clinix.ai
**Root:** `D:\clinixai-stage`
**Date:** 2026-05-31
**Mode:** Planning only. No code was modified, staged, committed, or deleted. No secrets exposed.
**Prereqs done:** Git cleanup (4 commits) + Twilio webhook signature verification (uncommitted, working tree).

Sources consulted: `PROJECT_RESCUE_AND_REFACTOR_PLAN.md`, `LOCAL_STACK_VERIFICATION_REPORT.md`, `GIT_CLEANUP_RECOMMENDATION.md`, `TWILIO_WEBHOOK_SECURITY_FIX_REPORT.md`, `PROJECT_KNOWLEDGE_BASE.md`, `FRONTEND_UI_QA_REPORT.md`, plus live code inspection.

---

## Confirmed facts from code inspection (so each session starts grounded)

| Question | Finding |
|---|---|
| Is `validate-token` under the strict auth limiter? | **Yes.** `app.js` line 128: `app.use('/api/auth', authLimiter, authRoutes)`. `authLimiter` = `max: 5 / 15min`. `authRoutes.js` line 12: `router.get('/validate-token', protect, validateToken)`. So GET validate-token shares the 5-request login budget. |
| Which patient-edit page is wired? | **`PatientEdit.tsx`** is imported and routed in `App.tsx` (line 7 + `/patients/:id/edit`). **`EditPatient.tsx` is NOT imported anywhere** — confirmed orphan. |
| Which i18n file is loaded? | **Only** `frontend/src/locales/en/translation.json` (imported in `frontend/src/i18n/index.ts` line 7). The legacy tree `frontend/src/i18n/locales/{en,ur}.json` is **not imported anywhere** (grep: no `i18n/locales` import). |
| Stripe seed state | `backend-node/seed-stripe-plans.js` exists; `STRIPE_PRICE_IDS` are placeholders (`price_YOUR_..._HERE`); the script **refuses to seed** while placeholders remain (exits 1). `subscriptionplans` collection is empty per verification report. |
| Demo seed building blocks | Models confirmed: `User` (bcrypt `passwordHash`, role `doctor`/`super_admin`), `Patient` (requires firstName, lastName, dateOfBirth, gender, doctorId), `Consultation` (status enum incl. `transcribed`), `Report` (requires consultationId, patientId, doctorId, content). Passwords hashed with `bcryptjs` (`bcrypt.hash(pw, 10)`). |
| Settings language issues | PRE-7: Urdu listed in Settings but only English shipped (silent fallback). PRE-6: language picker 🇺🇸 emoji renders as literal "us" on Windows. NEW-2: raw key `speech.languages.en-US` on `/new-consultation`. |

---

## Session 1 — Auth `validate-token` rate limiter fix

- **Goal:** Stop `GET /api/auth/validate-token` from consuming the 5-req/15-min login brute-force budget, without weakening protection on `login`/`register`.
- **Files to inspect:** `backend-node/src/app.js` (lines 88–128), `backend-node/src/routes/authRoutes.js`, `backend-node/src/controllers/authController.js`.
- **Files allowed to edit:** `backend-node/src/app.js` **OR** `backend-node/src/routes/authRoutes.js` (choose one approach below).
- **Files not allowed:** any frontend, `ai-service/**`, any `.env`, any controller logic.
- **Exact steps:**
  1. Pick the **smallest** change. Recommended: keep `authLimiter` mounted on `/api/auth` but add a `skip` so it ignores the validation/logout reads:
     ```js
     const authLimiter = rateLimit({
       windowMs: 15 * 60 * 1000,
       max: 5,
       skip: (req) => req.method === 'GET' && req.path === '/validate-token',
       // ...existing options
     });
     ```
     This keeps `max: 5` brute-force protection on `POST /login` and `POST /register` (credential endpoints) while exempting the GET session check.
  2. Optional hardening (only if requested): add a separate light limiter for `/validate-token` (`max: 60, windowMs: 60_000`) instead of fully exempting it.
  3. Do **not** change `protect`/`validateToken` behavior.
- **Tests to run:**
  - `node --check backend-node/src/app.js`
  - Start backend (`npm run start`), then loop 8× `Invoke-WebRequest http://localhost:5000/api/auth/validate-token` with a valid token → expect no 429.
  - Loop 6× `POST /api/auth/login` with bad creds → expect 429 after 5 (brute-force protection intact).
- **Stop conditions:** any change required to `login`/`register` limits; login no longer rate-limited; backend fails to start.
- **Suggested Cursor model:** `claude-4.6-sonnet-medium-thinking` (small but security-sensitive nuance).
- **Estimated risk:** **Low.**

---

## Session 2 — Retire legacy i18n locale tree

- **Goal:** Remove the dead `frontend/src/i18n/locales/` tree so contributors stop editing the wrong file. (C-8 / R-2)
- **Files to inspect:** `frontend/src/i18n/index.ts`, `frontend/src/i18n/locales/en.json`, `frontend/src/i18n/locales/ur.json`, and a repo-wide grep for `i18n/locales`.
- **Files allowed to edit/move:** `frontend/src/i18n/locales/**` (archive/move only).
- **Files not allowed:** `frontend/src/locales/en/translation.json` (the live file — do not touch values), backend, ai-service, `.env`.
- **Exact steps:**
  1. Re-confirm nothing imports `i18n/locales`: `grep -r "i18n/locales" frontend/src` → expect 0 import hits (already verified).
  2. Move the legacy files to `frontend/src/i18n/locales/legacy/` (archive, reversible) rather than hard-delete, per the "do not delete files" preference. If the user later approves deletion, `git rm` them in a tracked commit.
  3. Run the frontend build to confirm no broken import.
- **Tests to run:** `cd frontend; npm run build` (must succeed); `npm run lint` (count not worse than baseline).
- **Stop conditions:** any import of `i18n/locales` discovered (means it is NOT dead — stop and reassess); build breaks.
- **Suggested Cursor model:** `composer-2.5-fast` (mechanical, low-risk).
- **Estimated risk:** **Low.**

---

## Session 3 — Resolve duplicate patient-edit page

- **Goal:** Remove/archive the orphan `EditPatient.tsx` so the two pages can't diverge. (C-7 / R-1)
- **Files to inspect:** `frontend/src/App.tsx` (confirm only `PatientEdit` is routed), `frontend/src/pages/EditPatient.tsx`, `frontend/src/pages/PatientEdit.tsx`, repo grep for `EditPatient`.
- **Files allowed to edit/move:** `frontend/src/pages/EditPatient.tsx` (archive only).
- **Files not allowed:** `frontend/src/pages/PatientEdit.tsx` (the live page), `App.tsx` routing logic, backend, ai-service.
- **Exact steps:**
  1. Re-confirm `EditPatient` has zero imports/usages (already verified: only `PatientEdit` is imported in `App.tsx`).
  2. Move `EditPatient.tsx` → `frontend/src/pages/_archive/EditPatient.tsx` (or delete in a tracked commit if the user approves deletion). Do not modify `PatientEdit.tsx`.
  3. Build + smoke `/patients/:id/edit` route still renders `PatientEdit`.
- **Tests to run:** `cd frontend; npm run build`; manual visit `/patients/:id/edit` → loads PatientEdit; `npm run lint`.
- **Stop conditions:** any reference to `EditPatient` found anywhere; build/route breaks.
- **Suggested Cursor model:** `composer-2.5-fast` (mechanical).
- **Estimated risk:** **Low.**

---

## Session 4 — Targeted UI polish (no redesign)

- **Goal:** Close the small, pre-flagged UX gaps only.
- **Files to inspect:** `frontend/src/pages/Analytics.tsx`, `frontend/src/pages/FollowUps.tsx`, `frontend/src/pages/Appointments.tsx`, `frontend/src/pages/PastConsultations.tsx`, `frontend/src/pages/Settings.tsx`, `frontend/src/components/layout/Header.tsx` (language picker), `frontend/src/locales/en/translation.json`.
- **Files allowed to edit:** the above frontend pages/components + `frontend/src/locales/en/translation.json` + (if needed) `frontend/src/index.css`. Optionally add a small `frontend/src/components/EmptyState.tsx` (R-9).
- **Files not allowed:** `backend-node/**`, `ai-service/**`, any `.env`, any routing/auth logic.
- **Exact steps (each independently committable):**
  1. **Analytics empty state:** when no data, render a friendly `EmptyState` ("No analytics yet") instead of blank/zeros.
  2. **Past consultations enum labels:** map `consultationType` (`general`, `follow_up`, `initial`) and `status` enums through `t()` / a label map so users see "Follow-up" not `follow_up`.
  3. **Follow-ups & Appointments:** add an `EmptyState` plus a simple status filter (e.g. pending/confirmed/cancelled). No backend query change — filter client-side over existing data (PRE-4/PRE-5).
  4. **Settings language (PRE-7):** either hide Urdu until shipped, or label it "(coming soon)" and keep English as the only selectable option.
  5. **Language picker (PRE-6):** replace 🇺🇸 emoji with a 2-letter "EN" pill to fix the Windows "us" rendering.
  6. **NEW-2 raw key:** add the `speech.languages.*` keys to `translation.json` (or swap the dropdown to a static label map) so `speech.languages.en-US` no longer leaks.
- **Tests to run:** `cd frontend; npm run build`; `npm run lint` (not worse than baseline); visual recheck of `/analytics`, `/past-consultations`, `/follow-ups`, `/appointments`, `/settings`, `/new-consultation`.
- **Stop conditions:** scope creep into a redesign; new lint errors in untouched files; any backend edit needed.
- **Suggested Cursor model:** `claude-4.6-sonnet-medium-thinking` (multiple small UI judgments).
- **Estimated risk:** **Low–Medium.**

---

## Session 5 — FYP demo seed script (offline fallback)

- **Goal:** A safe seed so a demo never depends on live transcription/Stripe/Twilio/OpenAI: demo doctor + 2 patients + 1 completed consultation + 1 saved SOAP report. (Plan Session 7)
- **Files to inspect (read-only):** `backend-node/src/models/{User,Patient,Consultation,Report}.js`, `backend-node/src/controllers/authController.js` (password hashing), `backend-node/src/server.js` (existing super-admin bootstrap pattern to mirror).
- **Files allowed to edit/create:** a single new `backend-node/scripts/seed-demo.js` (new file). Optionally one line in `backend-node/package.json` `scripts` (`"seed:demo": "node scripts/seed-demo.js"`).
- **Files not allowed:** any controller, route, model, page, `.env`, ai-service.
- **Exact steps:**
  1. Connect via `MONGODB_URI` (same pattern as `seed-stripe-plans.js`). Guard: refuse to run if `NODE_ENV==='production'` unless an explicit `--force` flag is passed.
  2. Upsert a **demo doctor**: `email: demo@clinix.ai`, `passwordHash = bcrypt.hash('<demo password from arg/env>', 10)`, `role: 'doctor'`. Do **not** hardcode a real secret; read from `DEMO_DOCTOR_PASSWORD` env or a CLI arg, and print only a masked value.
  3. Create **2 patients** (required fields: firstName, lastName, dateOfBirth, gender, doctorId).
  4. Create **1 consultation**: `status: 'transcribed'`, `consultationType: 'general'`, `recordingType` set, linked to patient 1 + doctor. Put a canned transcript in `notes`/`metadata` — **no audio upload, no OpenAI call.**
  5. Create **1 Report**: `content` = a prewritten SOAP markdown string, `format: 'SOAP'`, `status: 'generated'`, linked to the consultation/patient/doctor.
  6. Make the script **idempotent** (upsert by email / deterministic keys) so re-runs don't duplicate.
  7. No outbound calls: do not import `twilioService`, Stripe, or OpenAI services.
- **Tests to run:** `node backend-node/scripts/seed-demo.js` against a **local/demo** DB; then log in as the demo doctor and confirm the patient list, the consultation, and the saved report all render with **no** live AI dependency. Do **not** run Stripe/OpenAI.
- **Stop conditions:** any need to call Twilio/Stripe/OpenAI; any change to auth or pricing logic; running against a production DB.
- **Suggested Cursor model:** `gpt-5.3-codex` (script-writing against known schemas).
- **Estimated risk:** **Low–Medium** (writes to DB — keep it pointed at demo/local only).

---

## Session 6 — Stripe subscription readiness (plan + dry steps only; do NOT run yet)

- **Goal:** Make `subscriptionplans` seedable with real **test-mode** Stripe price IDs so `/pricing` checkout stops failing — without any production charge. (C-1)
- **Files to inspect:** `backend-node/seed-stripe-plans.js`, `backend-node/src/controllers/subscriptionController.js`, `backend-node/src/models/SubscriptionPlan.js`, `frontend/src/pages/Pricing.tsx`, `.env.example` (Stripe keys).
- **Files allowed to edit:** `backend-node/seed-stripe-plans.js` (fill real **test** price IDs), `backend-node/.env.example` (document keys). Do not touch real `.env`.
- **Files not allowed:** controllers/business logic, frontend checkout flow, ai-service.
- **Exact steps (preparation — execution is gated on your approval + test keys):**
  1. In the **Stripe TEST dashboard** (not live), create 2 products (Starter, Pro) each with monthly + yearly prices → 4 test price IDs (`price_...`).
  2. Put those **test** IDs into `STRIPE_PRICE_IDS` in `seed-stripe-plans.js`. Keep live keys out of the repo.
  3. Ensure `STRIPE_SECRET_KEY` in local `.env` is a **test** key (`sk_test_...`), never live.
  4. **When approved**, run `npm run seed:stripe` against the **local/test** DB; verify `subscriptionplans.find()` returns 4 docs with non-empty `stripePriceId`.
  5. Smoke `/pricing` → "Get started" reaches Stripe **test** checkout (no real charge). Until seeded, consider hiding paid CTAs behind a flag.
- **Tests to run:** `node --check backend-node/seed-stripe-plans.js`; (gated) the seed run + a single test-mode checkout session creation. **No live keys, no real charges.**
- **Stop conditions:** any live (`sk_live_`/`price_live`) key encountered; any real charge risk; seeding against production DB.
- **Suggested Cursor model:** `claude-opus-4-8-thinking-high` (billing correctness + safety judgment).
- **Estimated risk:** **Medium** (external service + money path; mitigated by test-mode-only).

---

## Cross-session guardrails

- Never `git add .`, never push, never rebase/force-push.
- Never edit real `.env` files; only `*.env.example`.
- No Stripe/OpenAI/Twilio live calls without explicit approval.
- One concern per commit; keep each session's diff small and reviewable.
- Run `npm run build` (frontend) / `node --check` (backend) before declaring a session done.

---

## Final summary

- **Report path:** `D:\clinixai-stage\NEXT_IMPLEMENTATION_SESSIONS.md`
- **Recommended next 5 sessions, in order:**
  1. **Session 1 — Auth `validate-token` rate limiter** (Low risk; directly fixes the session-drop UX that the Twilio/Git work depends on)
  2. **Session 2 — Retire legacy i18n tree** (Low)
  3. **Session 3 — Remove duplicate patient-edit page** (Low)
  4. **Session 4 — Targeted UI polish** (Low–Medium)
  5. **Session 5 — FYP demo seed script** (Low–Medium)
  - (Session 6 — Stripe readiness — schedule 6th; needs Stripe test keys + your approval before any run.)
- **First session to implement next:** **Session 1 — Auth `validate-token` rate limiter fix** in `backend-node/src/app.js`.
- **Was code modified:** **No.**
