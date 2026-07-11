# Dead Code & Bloat Audit — Clinix.ai

**Project:** Clinix.ai
**Root:** `D:\clinixai-stage`
**Date:** 2026-05-31
**Mode:** **Audit only.** No files were deleted, moved, edited, staged, or committed. No `git add`. No `.env` touched. No secrets exposed. No code refactored.
**Method:** Read of 7 source-of-truth docs + live filesystem inspection (line counts, directory sizes, existence checks) + repo-wide grep for imports/usages/dependencies.

Sources consulted: `PROJECT_KNOWLEDGE_BASE.md`, `PROJECT_RESCUE_AND_REFACTOR_PLAN.md`, `NEXT_IMPLEMENTATION_SESSIONS.md`, `GIT_CLEANUP_RECOMMENDATION.md`, `DUPLICATE_PATIENT_EDIT_CLEANUP_REPORT.md`, `I18N_LEGACY_CLEANUP_REPORT.md`, `TARGETED_UI_POLISH_REPORT.md`.

---

## 0. Headline numbers

| Metric | Value |
|---|---|
| Files/folders recommended for removal (Tables A + B) | **20** (12 delete-now + 8 archive/move) |
| Items needing manual review before action (Table D) | **9** |
| Confirmed-unused dependencies (frontend + backend) | **6** (`zustand`, `jspdf`, `react-hook-form`, `date-fns`, `@types/axios`, `sharp`) |
| Reclaimable disk now (generated/stray, gitignored) | **~313 MB** (`backend-node/uploads` 123 MB + root `.venv` 67 MB + `frontend/dist` + duplicate venv space) |
| Source files over 400 lines | **15** (excluding legacy `app.py`) |
| Was code modified | **No** |

---

## 1. Active vs inactive folders

| Folder | Size | Status | Evidence |
|---|---|---|---|
| `frontend/` | 298 MB (mostly `node_modules`) | **ACTIVE** | Vite app; `npm run dev`; in `docker-compose.yml` + `start-local.ps1`. |
| `backend-node/` | 338 MB (mostly `node_modules` + 123 MB `uploads`) | **ACTIVE** | Express API; `src/server.js`; in compose + start script. |
| `ai-service/` | 67.8 MB (mostly `.venv`) | **ACTIVE** | FastAPI; `app/main.py`; in compose + start script. |
| `backend-legacy/` | 0.2 MB | **INACTIVE / DEPRECATED** | Flask monolith. **Not** in `docker-compose.yml`, **not** started by `start-local.ps1`. Conflicts on port 5000. KB §3 + Plan H-11 flag it as a footgun. |
| `qa-screenshots/` | 3.5 MB (16 PNGs) | **INACTIVE / EVIDENCE** | QA artifacts, synthetic data. Not imported/executed. Keep-local or archive. |
| `.venv/` (root) | 66.9 MB | **STRAY / ORPHAN** | A second Python venv at repo root. Only `ai-service\.venv` is referenced by `start-local.ps1` (`$venvPython = ...ai-service '.venv\Scripts\python.exe'`). Root `.venv` is unused. Gitignored. |
| `frontend/dist/` | generated | **GENERATED** | Vite build output. Gitignored by `frontend/.gitignore` (`dist`). Regenerable via `npm run build`. |
| `backend-node/uploads/` | 123.4 MB | **GENERATED MEDIA** | Runtime audio/report/patient-file storage. Gitignored. Never share. |
| `frontend/src/pages/_archive/` | — | **ARCHIVED ORPHAN** | Holds `EditPatient.tsx` already moved out of routing (see §2). |
| `frontend/src/i18n/locales/legacy/` | ~41 KB | **ARCHIVED ORPHAN** | Old locale tree already moved here; not imported (see §2). |

No `temp/` or generic `archive/` folders exist beyond the two `legacy`/`_archive` ones above.

---

## 2. Dead / legacy / temp / duplicate files

All paths below were existence-verified on disk and cross-checked for imports/usage.

### Verified special files (from the task list)

| File / folder | Exists | Size | Verdict | Evidence |
|---|---|---|---|---|
| `temp_diff.txt` | Yes | 16.8 KB | **DEAD — scratch diff** | Not imported/executed anywhere; KB §2 calls it a temporary artifact; already committed in history (`GIT_CLEANUP_RECOMMENDATION.md` §2 Group F). |
| `ai-service/temp_transcribe_test.wav` | Yes | 191 KB | **DEAD — test media artifact** | Not referenced by `app/**`; manual test fixture. |
| `frontend/src/pages/_archive/EditPatient.tsx` | Yes | 19.4 KB (467 lines) | **DEAD — archived orphan** | `DUPLICATE_PATIENT_EDIT_CLEANUP_REPORT.md` confirms only `PatientEdit.tsx` is routed in `App.tsx`. `EditPatient` has zero active imports. Already moved to `_archive`. |
| `frontend/src/i18n/locales/legacy/en.json` | Yes | 34.1 KB | **DEAD — archived orphan** | `I18N_LEGACY_CLEANUP_REPORT.md`: only `src/locales/en/translation.json` is wired via `i18n/index.ts`. No import of `i18n/locales`. |
| `frontend/src/i18n/locales/legacy/ur.json` | Yes | 6.7 KB | **DEAD — archived orphan** | Same as above; Urdu not shipped. |
| `ApiError.js` (repo root) | Yes | 329 B | **DEAD — duplicate stray** | Root copy uses CommonJS `module.exports`; the **active** `backend-node/src/utils/ApiError.js` uses ESM `export class` and is the one imported by `errorHandler.js`, `authController.js`, `agentController.js`, `auth.js`. Root file is unimportable in an ESM project and used by nothing. |
| `ai-service/test_transcribe.py` | Yes | 676 B | **DEAD — scratch script** | Ad hoc manual test, not a pytest suite; not executed by Docker/start scripts. KB §18. |
| `ai-service/transcribe_test.py` | Yes | 597 B | **DEAD — scratch script** | Duplicate-purpose scratch script alongside `test_transcribe.py`. KB §18. |
| `backend-legacy/test_openai.py` | Yes | 1.3 KB | **DEAD — scratch script (legacy)** | Inside deprecated folder; ad hoc OpenAI connectivity test. |
| `qa-screenshots/` | Yes | 3.5 MB | **REVIEW — keep local / gitignore** | Synthetic QA evidence; not used by build/runtime. |
| `*_REPORT.md`, `*_PLAN.md`, `*_RECOMMENDATION.md` | Yes (16 files) | ~270 KB | **KEEP/CONSOLIDATE** | See §2.2. |

### Additional dead/stray files found during inspection

| File | Verdict | Evidence |
|---|---|---|
| `ai-service/tts.ps1` | **DEAD — scratch script** (280 B) | One-off TTS helper; not referenced by `app/**`, Docker, or start scripts. |
| `ai-service/package-lock.json` | **DEAD — stray lockfile** | A Node `package-lock.json` inside a **Python** service. There is **no `ai-service/package.json`**. Orphaned; misleads contributors. |
| `.venv/` (root) | **STRAY venv** (67 MB) | See §1; only `ai-service/.venv` is used. |
| `frontend/dist/` | **GENERATED** | Regenerable; gitignored. |

### 2.2 Documentation sprawl (16 markdown reports at root)

`AUTH_RATE_LIMIT_FIX_REPORT.md`, `DUPLICATE_PATIENT_EDIT_CLEANUP_REPORT.md`, `FINAL_PROJECT_ISSUE_TRACKER.md` (21 KB), `FRONTEND_UI_QA_REPORT.md`, `GIT_CLEANUP_RECOMMENDATION.md`, `I18N_LEGACY_CLEANUP_REPORT.md`, `LOCAL_STACK_VERIFICATION_REPORT.md`, `NEXT_IMPLEMENTATION_SESSIONS.md`, `PROJECT_KNOWLEDGE_BASE.md` (73 KB), `PROJECT_RESCUE_AND_REFACTOR_PLAN.md` (35 KB), `SECURITY_FIX_REPORT.md`, `TARGETED_UI_POLISH_REPORT.md`, `TWILIO_WEBHOOK_SECURITY_FIX_REPORT.md`, `UI_UX_AUDIT_REPORT.md`, `UI_UX_FIX_REPORT.md`, `UI_UX_SECOND_FIX_REPORT.md`.

- **None are dead** (they are real history), but they clutter the root. Recommendation: **move point-in-time reports into `docs/archive/`** and keep only the 3 living docs at root (`PROJECT_KNOWLEDGE_BASE.md`, `PROJECT_RESCUE_AND_REFACTOR_PLAN.md`, `NEXT_IMPLEMENTATION_SESSIONS.md`) + `README.md`. This is organizational, not deletion.

---

## 3. Large / messy source files

Line counts measured live. Threshold: 400 lines.

| File | Lines | Why it's messy | What to extract | Safest refactor strategy | Risk |
|---|---|---|---|---|---|
| `backend-legacy/app.py` | **4399** | Entire deprecated Flask monolith in one file. | N/A — do not refactor. | **Archive the whole folder** (Table B). Do not invest. | **Low** (archive) / High (if refactored) |
| `frontend/src/pages/NewConsultation.tsx` | **1209** | Recording, upload, socket progress, AI-task polling, patient quick-add, and UI all in one component; mixed state + side-effects. KB §16, Plan H-10. | `useConsultationRecorder()` hook; `useAiTaskProgress()` hook; quick-add patient sub-component. | Extract hooks first (Plan R-3), keep JSX in place; verify socket events still fire. | **High** (core demo path, no tests) |
| `frontend/src/pages/PastConsultations.tsx` | **1170** | Consultation history + transcript editor + report preview + PDF actions duplicated from Dashboard/PatientDetail. | `<TranscriptionEditor />`, shared report/PDF hook. | Extract `<TranscriptionEditor />` (Plan R-4) into shared component reused by 3 pages. | **High** |
| `frontend/src/pages/PatientDetail.tsx` | **942** | Patient info + files + reports + transcripts; reuses Dashboard transcription/PDF logic (duplication). | Shared transcription-view + report-action hooks. | Consolidate with the shared hook above; move file panel to its own component. | **Medium–High** |
| `frontend/src/pages/super-admin/UserManagement.tsx` | **913** | Large CRUD table + modals + filters inline. | Table, row, and modal components; data hook. | Extract presentational components; keep API calls. | **Medium** |
| `frontend/src/components/ReportPreviewModal.tsx` | **750** | Big modal: structured-content rendering + edit + export, shared by several pages. | Section renderers; export action hook. | Split section renderers into sub-components. | **Medium** |
| `frontend/src/pages/Patients.tsx` | **741** | List + create modal + search + validation inline. | `<PatientForm />`, list/table component. | Extract form + table; keep service calls. | **Medium** |
| `backend-node/src/controllers/consultationController.js` | **660** | Many responsibilities: CRUD, upload pipeline trigger, preview, save, PDF generation, appointment sync. KB §16. | Split report-preview/PDF handlers and appointment-sync into separate controller/service modules. | Move report endpoints to a `reportController` section + `reportService`; keep route signatures stable. | **Medium–High** (touches AI pipeline + PDF) |
| `frontend/src/pages/Dashboard.tsx` | **603** | Stats + recent consultations + transcription view + PDF actions (duplicated). | Same shared transcription/report hook as PastConsultations/PatientDetail. | Adopt the shared hook; keep layout. | **Medium** |
| `frontend/src/pages/Reports.tsx` | **601** | List + download + delete + table inline. | Table + row-action components. | Extract presentational components. | **Low–Medium** |
| `frontend/src/pages/super-admin/SubscriptionPlansManagement.tsx` | **563** | Plan CRUD + modals inline. | Form + table components. | Extract components. | **Low–Medium** |
| `frontend/src/services/subscriptionService.ts` | **480** | Large service; uses `axios` directly (25 date/`new Date` usages); KB §16 flags missing imports/helpers. | Centralize axios client + date helpers. | Route through `apiFetch.ts` + a `formatDate` util (Plan R-6). | **Medium** (billing path) |
| `frontend/src/pages/PatientEdit.tsx` | **477** | The **active** edit page; large form + validation inline. | `<PatientForm />` shared with `Patients.tsx`. | Extract shared form. | **Medium** |
| `frontend/src/pages/super-admin/LanguageSettings.tsx` | **426** | In-memory language config UI, large. | Component split. | Low priority. | **Low** |
| `backend-node/src/services/aiTaskService.js` | **377** (just under 400) | Workflow orchestration + persistence + socket emits in one file. KB §16 lists it as a split candidate. | Per-stage workers into `aiWorkflowService` (already exists); keep orchestration thin. | Move stage bodies out; keep queue/resume logic. | **High** (background AI pipeline, no tests) |

> `frontend/src/pages/_archive/EditPatient.tsx` (467 lines) is **dead** (Table A), not a refactor target.

---

## 4. Duplicate logic

| Duplicated concern | Where | Evidence | Consolidation |
|---|---|---|---|
| **API client / auth headers** | ~12 pages call `axios` directly instead of using the 12 service modules in `src/services/`. Direct-axios pages: `Settings`, `NewConsultation`, `PastConsultations`, `Reports`, `Analytics`, `PatientDetail`, `Dashboard`, `Patients`, `Appointments`, `FollowUps`, `SubscriptionManagement`, `BookAppointment`, `super-admin/UserManagement`. | Grep: direct `axios.(get/post/...)` in pages; `apiFetch.ts` exists but bypassed. KB §9, Plan H-13/R-6. | Single `apiClient` (`axios.create({ baseURL:'/api', auth header injector })`) in `apiFetch.ts`; pages call services only. |
| **Transcription / report / PDF UI** | `Dashboard.tsx`, `PatientDetail.tsx`, `PastConsultations.tsx` each re-implement transcription fetch + modal + PDF/report actions. | KB §9 architectural note; Plan R-4. | Shared `useTranscription()` hook + `<TranscriptionEditor />` + `<ReportActions />`. |
| **Date formatting** | `new Date(...).toLocaleDateString()` scattered across ~15 files (`Patients` 10, `subscriptionService` 25, `Dashboard` 6, `PatientDetail` 8, etc.). | Grep counts. `date-fns` is installed but **unused**. | One `formatDate`/`formatDateTime` util (or adopt installed `date-fns`). |
| **Status / enum labels** | `consultation_type` / `status` enum→label maps re-done per page; `TARGETED_UI_POLISH_REPORT.md` notes PastConsultations got a local `t()` map. | Plan §5.1; UI polish report. | One shared label map / `t()` keys reused across pages. |
| **Upload handling** | `FileUploadPanel.tsx`, `NewConsultation.tsx`, patient-file upload each manage multipart + size hints. | KB §9; FileUploadPanel present. | Shared upload hook + consistent MIME/size hinting. |
| **Empty state / cards** | Already partially consolidated via new `EmptyState.tsx` (UI polish report). Cards/tables still ad hoc per page. | TARGETED_UI_POLISH_REPORT.md. | Continue adopting `EmptyState`; add shared `<Card>`/`<DataTable>` later. |

---

## 5. Dependency / package bloat (package.json inspection only — nothing uninstalled)

### Frontend (`frontend/package.json`)

| Package | Status | Evidence |
|---|---|---|
| `zustand` | **UNUSED** | No `from 'zustand'` / `create(` in `src/**`; only appears in package.json + lockfile. KB §9 ("not clearly central"). |
| `jspdf` | **UNUSED** | No `jspdf`/`jsPDF` usage in `src/**`. PDF is generated server-side via PDFKit. |
| `react-hook-form` | **UNUSED** | No `useForm`/`react-hook-form` in `src/**`. KB §9 ("not prominent"). Forms use local state. |
| `date-fns` | **UNUSED** | No `date-fns` import in source; dates formatted manually. |
| `@types/axios` | **OBSOLETE** | Modern `axios` ships its own types; this stub package is deprecated and unnecessary. |
| `react-icons` | **LOW USE / REVIEW** | Used in only 4 files (Dashboard, Pricing, SubscriptionManagement, super-admin/SubscriptionPlansManagement) while `lucide-react` is the primary icon set → consolidate to one icon library. |

### Backend (`backend-node/package.json`)

| Package | Status | Evidence |
|---|---|---|
| `sharp` | **UNUSED** | No `sharp` reference anywhere in `backend-node/src/**`. Image processing not wired. |
| `@google-cloud/speech` | **USED (keep)** | Imported by `services/googleSpeechService.js`, wired into `pythonService.js` as transcription fallback. |
| `pdf-parse`, `pdfkit`, `form-data`, `twilio`, `stripe`, `openai`, `mongoose`, etc. | **USED (keep)** | Referenced in services/controllers. |

> All dependency removals are **Table D (manual review)** — verify no dynamic import / build-time use before uninstalling.

---

## 6. Safe cleanup classification

### A. Safe to delete now (confirmed unused, low risk)

| # | Item | Reason |
|---|---|---|
| 1 | `temp_diff.txt` | Scratch diff; no references. |
| 2 | `ai-service/temp_transcribe_test.wav` | Test media artifact. |
| 3 | `ApiError.js` (root) | CommonJS stray; active ESM copy lives in `backend-node/src/utils/`. |
| 4 | `ai-service/test_transcribe.py` | Scratch script. |
| 5 | `ai-service/transcribe_test.py` | Scratch script (duplicate). |
| 6 | `ai-service/tts.ps1` | One-off scratch script. |
| 7 | `ai-service/package-lock.json` | Stray Node lockfile in a Python service (no `package.json`). |
| 8 | `frontend/src/pages/_archive/EditPatient.tsx` | Confirmed orphan; already archived. |
| 9 | `frontend/src/i18n/locales/legacy/en.json` | Confirmed unused legacy locale. |
| 10 | `frontend/src/i18n/locales/legacy/ur.json` | Confirmed unused legacy locale. |
| 11 | `frontend/dist/` | Regenerable build output (gitignored). |
| 12 | `.venv/` (repo root) | Stray venv; only `ai-service/.venv` is used (regenerable). |

### B. Safe to archive / move (useful reference, not active)

| # | Item | Action |
|---|---|---|
| 1 | `backend-legacy/` (whole folder, incl. `app.py` 4399 lines, `seed_*.py`, `stt.py`, `test_openai.py`) | Move to `docs/legacy/` or a separate branch/zip; add a "DO NOT START" banner (Plan R-8). |
| 2 | `qa-screenshots/` | Keep local or move to `docs/qa/`; add to `.gitignore` if not committing. |
| 3–8 | Point-in-time reports: `AUTH_RATE_LIMIT_FIX_REPORT.md`, `FRONTEND_UI_QA_REPORT.md`, `GIT_CLEANUP_RECOMMENDATION.md`, `I18N_LEGACY_CLEANUP_REPORT.md`, `LOCAL_STACK_VERIFICATION_REPORT.md`, `SECURITY_FIX_REPORT.md`, `TARGETED_UI_POLISH_REPORT.md`, `TWILIO_WEBHOOK_SECURITY_FIX_REPORT.md`, `UI_UX_AUDIT_REPORT.md`, `UI_UX_FIX_REPORT.md`, `UI_UX_SECOND_FIX_REPORT.md`, `FINAL_PROJECT_ISSUE_TRACKER.md` | Consolidate under `docs/archive/`. (Counted as 6 grouped move-actions for the headline; individually 12 files.) |

### C. Keep for now (needed by active project)

- `frontend/src/**`, `backend-node/src/**`, `ai-service/app/**` (all active source).
- `README.md`, `docker-compose.yml`, `start-local.ps1`, all `Dockerfile`s, all `.env.example`, `nginx.conf`, `*.config.js`, `tsconfig*.json`.
- Living docs: `PROJECT_KNOWLEDGE_BASE.md`, `PROJECT_RESCUE_AND_REFACTOR_PLAN.md`, `NEXT_IMPLEMENTATION_SESSIONS.md`, this audit.
- `backend-node/seed-stripe-plans.js`, `backend-node/src/services/googleSpeechService.js` + `@google-cloud/speech`.
- All dependencies **not** listed in §5 as unused.

### D. Needs manual review (potentially unused but risky)

| # | Item | Why risky |
|---|---|---|
| 1 | `zustand` (frontend) | Confirm no dynamic/store usage before uninstall. |
| 2 | `jspdf` (frontend) | Confirm no lazy import in PDF/export path. |
| 3 | `react-hook-form` (frontend) | Confirm no form planned to keep it. |
| 4 | `date-fns` (frontend) | Could be adopted instead of removed (date dedup). |
| 5 | `@types/axios` (frontend) | Safe to drop, but verify TS build. |
| 6 | `sharp` (backend) | Confirm no image-resize path before uninstall. |
| 7 | `react-icons` vs `lucide-react` | Consolidation requires editing 4 files (touches UI). |
| 8 | `ai-service` endpoints `/extract-followup`, `/send-reminder` | KB §12 says "not clearly called by backend-node" — possible dead endpoints, but Twilio/followup logic overlaps; verify before removing. |
| 9 | `backend-node` test/debug routes (`testRoutes.js`/`testController.js`) and `openaiWhisperService` double-billing path | Security/behavior sensitive — already partly hardened; do not delete blindly. |

### E. Never commit / share (already gitignored — keep local only)

- `node_modules/` (frontend + backend), `.venv/` (root) and `ai-service/.venv/`
- `backend-node/uploads/` (123 MB generated media), any `uploads/`
- `.env` files: `backend-node/.env`, `ai-service/.env`, `frontend/.env` — **do not open, do not commit, rotate if ever shared**
- `frontend/dist/` (generated)
- `backend-node/secrets/` and any `*.json` credentials

> `.gitignore` already covers `.env`, `node_modules/`, `.venv/`, `uploads/`, `backend-node/uploads/`, `secrets/`. `frontend/.gitignore` additionally covers `dist`. Confirmed **no real `.env` is tracked**.

---

## 7. Cleanup execution plan (7 sessions)

> Cross-session guardrails: never `git add .`; never push/rebase/force-push; never edit real `.env`; build before declaring done; one concern per commit; if any "stop condition" hits, stop and reassess.

### Session 1 — Remove temp / generated / stray files
- **Files allowed:** Table A items 1–7 (`temp_diff.txt`, `ai-service/temp_transcribe_test.wav`, root `ApiError.js`, `ai-service/test_transcribe.py`, `ai-service/transcribe_test.py`, `ai-service/tts.ps1`, `ai-service/package-lock.json`). Generated/stray: `frontend/dist/`, root `.venv/`.
- **Files NOT allowed:** any `src/**`, any `.env`, `ai-service/.venv`, `backend-node/uploads` (leave alone — gitignored runtime data).
- **Commands:**
  ```powershell
  cd D:\clinixai-stage
  # confirm zero references first
  git grep -n "temp_diff" ; git grep -n "temp_transcribe_test"
  git rm --cached temp_diff.txt ai-service/temp_transcribe_test.wav   # if tracked
  Remove-Item temp_diff.txt, ai-service\temp_transcribe_test.wav, ApiError.js, ai-service\test_transcribe.py, ai-service\transcribe_test.py, ai-service\tts.ps1, ai-service\package-lock.json
  Remove-Item -Recurse -Force frontend\dist, .venv
  # add ignores
  Add-Content .gitignore "temp_diff.txt`nqa-screenshots/"
  ```
- **Build/test:** `cd ai-service; python -m py_compile app\main.py` (still imports cleanly); `cd backend-node; node --check src/app.js`; `cd frontend; npm run build`.
- **Stop conditions:** any grep hit referencing a file you are about to remove; build/import failure.
- **Commit message:** `chore(cleanup): remove temp diff, scratch scripts, stray venv and node lockfile`

### Session 2 — Archive legacy backend folder
- **Files allowed:** `backend-legacy/**` (move only) + its README (add banner).
- **Files NOT allowed:** `backend-node/**`, `ai-service/**`, `frontend/**`, `docker-compose.yml`.
- **Commands:**
  ```powershell
  cd D:\clinixai-stage
  git grep -n "backend-legacy"   # expect only docs references
  New-Item -ItemType Directory docs\legacy -Force
  git mv backend-legacy docs/legacy/backend-legacy   # or Move-Item if untracked
  ```
- **Build/test:** start the stack via `start-local.ps1` (or `docker-compose config`) and confirm frontend/backend/ai-service still start; legacy was never wired so nothing should break.
- **Stop conditions:** any compose/start-script reference to `backend-legacy`; port-5000 conflict surfaces.
- **Commit message:** `chore(legacy): archive deprecated Flask backend to docs/legacy`

### Session 3 — Remove archived frontend / i18n files
- **Files allowed:** `frontend/src/pages/_archive/EditPatient.tsx`, `frontend/src/i18n/locales/legacy/en.json`, `frontend/src/i18n/locales/legacy/ur.json` (delete).
- **Files NOT allowed:** `frontend/src/pages/PatientEdit.tsx`, `frontend/src/locales/en/translation.json`, `frontend/src/i18n/index.ts`.
- **Commands:**
  ```powershell
  cd D:\clinixai-stage
  git grep -n "EditPatient" frontend/src ; git grep -n "i18n/locales" frontend/src   # expect 0 active import hits
  git rm frontend/src/pages/_archive/EditPatient.tsx frontend/src/i18n/locales/legacy/en.json frontend/src/i18n/locales/legacy/ur.json
  ```
- **Build/test:** `cd frontend; npm run build` (must pass); visit `/patients/:id/edit` → still renders `PatientEdit`; `npm run lint` (errors should drop as `_archive` stops being scanned).
- **Stop conditions:** any active import of `EditPatient` or `i18n/locales`; build break.
- **Commit message:** `chore(frontend): delete archived EditPatient page and legacy i18n locales`

### Session 4 — Simplify large frontend pages (refactor, no behavior change)
- **Files allowed:** `NewConsultation.tsx`, `PastConsultations.tsx`, `PatientDetail.tsx`, `Dashboard.tsx` + new `frontend/src/hooks/*` and `frontend/src/components/*` you create.
- **Files NOT allowed:** `backend-node/**`, `ai-service/**`, any `.env`, routing/auth logic, API contracts.
- **Steps:** extract `useConsultationRecorder()` (R-3) and `useAiTaskProgress()` from `NewConsultation`; extract `<TranscriptionEditor />` (R-4) reused by the 3 transcript pages. One extraction per commit.
- **Build/test:** `npm run build`; `npm run lint` (not worse than baseline 192); manual smoke of new-consultation upload → transcription progress, and transcript edit on past-consultations.
- **Stop conditions:** socket events stop firing; any change required outside frontend; lint regression in untouched files.
- **Commit message:** `refactor(frontend): extract consultation recorder + transcription editor hooks/components`

### Session 5 — Simplify backend controller / services (refactor, no behavior change)
- **Files allowed:** `backend-node/src/controllers/consultationController.js`, `backend-node/src/services/aiTaskService.js` + new `reportController`/`reportService`/`aiWorkflowService` modules.
- **Files NOT allowed:** routes' public signatures, models, `frontend/**`, `ai-service/**`, `.env`.
- **Steps:** move report-preview/PDF handlers out of `consultationController` into a report module; move per-stage AI workers out of `aiTaskService` into `aiWorkflowService`. Keep route → handler names stable.
- **Build/test:** `node --check` each edited file; start backend; run §9.1 manual smoke (upload-audio → AiTask → transcribed → report preview → save → PDF download).
- **Stop conditions:** any route response shape changes; AI pipeline regresses; no quick rollback available.
- **Commit message:** `refactor(backend): split report endpoints and AI workflow stages out of large modules`

### Session 6 — Package / dependency audit (remove confirmed-unused only)
- **Files allowed:** `frontend/package.json`, `backend-node/package.json` (+ lockfiles regenerated by install).
- **Files NOT allowed:** source files (unless removing the single `react-icons` consolidation, which should be its own later commit), `.env`.
- **Steps:** after re-confirming zero usage, remove `zustand`, `jspdf`, `react-hook-form`, `date-fns`, `@types/axios` (frontend) and `sharp` (backend). Leave `react-icons`/`lucide-react` consolidation for a separate UI commit.
- **Commands:**
  ```powershell
  cd frontend; npm remove zustand jspdf react-hook-form date-fns @types/axios; npm run build; npm run lint
  cd ..\backend-node; npm remove sharp; node --check src/app.js; npm run start  # smoke
  ```
- **Build/test:** frontend `npm run build` must pass; backend must boot and pass §9.1 smoke.
- **Stop conditions:** any build/runtime error after a removal → re-add that package and flag for manual review.
- **Commit message:** `chore(deps): remove unused zustand/jspdf/react-hook-form/date-fns/@types/axios/sharp`

### Session 7 — Final documentation cleanup
- **Files allowed:** root `*_REPORT.md`/`*_PLAN.md`/`*_RECOMMENDATION.md` (move into `docs/archive/`); `README.md` (add a "Docs index" pointer); `qa-screenshots/` (move to `docs/qa/` or gitignore).
- **Files NOT allowed:** any source, any `.env`.
- **Steps:** keep `README.md` + 3 living docs at root; move the 12 point-in-time reports to `docs/archive/`; move `qa-screenshots/` and ensure it's gitignored.
- **Build/test:** none (docs only); confirm links in moved docs still resolve.
- **Stop conditions:** a "report" turns out to be referenced by tooling/CI.
- **Commit message:** `docs: consolidate point-in-time reports into docs/archive and add docs index`

---

## 8. Top 10 safest cleanup actions

1. Delete `temp_diff.txt` (scratch diff, zero references).
2. Delete `ai-service/temp_transcribe_test.wav` (test media artifact).
3. Delete root `ApiError.js` (CommonJS stray; active ESM copy is in `backend-node/src/utils/`).
4. Delete `ai-service/test_transcribe.py` and `transcribe_test.py` (scratch scripts).
5. Delete `ai-service/tts.ps1` (one-off scratch script).
6. Delete `ai-service/package-lock.json` (orphan Node lockfile in a Python service).
7. Delete `frontend/src/pages/_archive/EditPatient.tsx` (confirmed orphan, already archived).
8. Delete `frontend/src/i18n/locales/legacy/{en,ur}.json` (confirmed unused locales).
9. Delete `frontend/dist/` and root stray `.venv/` (both regenerable, gitignored).
10. Remove confirmed-unused deps `zustand`, `jspdf`, `react-hook-form`, `date-fns`, `@types/axios`, `sharp` (after a final usage re-check + build).

## 9. Top 5 risky cleanup actions

1. **Refactoring `NewConsultation.tsx` (1209 lines)** — core demo path, no tests; high regression risk on recording/upload/socket flow.
2. **Refactoring `aiTaskService.js` / `consultationController.js`** — background AI pipeline + report/PDF + appointment sync; behavioral regression risk, no tests.
3. **Removing `sharp` / `@google-cloud/speech`-adjacent code** — image/transcription fallbacks may be invoked dynamically; verify before touching.
4. **Deleting `backend-legacy/` outright** instead of archiving — loses reference for any un-migrated logic; archive (Table B) rather than delete.
5. **Removing `ai-service` `/extract-followup` & `/send-reminder` endpoints** — overlap with backend Twilio/followup logic; "not clearly called" ≠ confirmed dead. Trace callers first.

---

## 10. Final status

- **Report path:** `D:\clinixai-stage\DEAD_CODE_AND_BLOAT_AUDIT.md`
- **Files/folders recommended for removal:** **20** (12 delete-now in Table A + 8 archive/move groups in Table B).
- **Items needing manual review:** **9** (Table D), including 6 unused-dependency removals.
- **Was code modified:** **No.** No files deleted, moved, edited, staged, or committed; no `.env` touched; no secrets exposed.
