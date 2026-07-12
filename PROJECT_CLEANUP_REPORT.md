# Project Cleanup Report — Clinix.ai

Prepared for production deployment to **Azure App Service** with **MongoDB Atlas**.

All changes were made on branch `main` in small, verified commits. Every deletion was
confirmed by static reference analysis before removal, and the frontend build + backend
module graph were re-verified after each major step. Nothing was removed without verifying
it had zero inbound references.

---

## Critical fix — botched merge resolved (blocker)

The repository was in a **broken, non-building state**: a previous merge commit
(`fd3a8ff`, "Merge my-working-code into main…") had committed **unresolved Git conflict
markers** into 13 files and pulled ~1,883 lines of stale code from an older line
(`e9d40771`, "docs: improve README") on top of the feature-complete working branch.
`backend-node/package.json` was invalid JSON, so `npm install` would have failed.

**Resolution:** aligned the 39 affected files to the clean `my-working-code` branch (the
feature-complete lineage, 0 conflict markers), matching the merge commit's stated intent
("resolving conflicts in favor of working branch"). History is preserved.

- Files affected: 39 · Conflict markers removed: 101 across 13 files
- Verified afterwards: `git grep` for markers → **0 remaining**

---

## Files Removed

### Dead source code (verified 0 references)
Backend (`backend-node/src`):
- `controllers/analyticsController.js` — no route wires it
- `services/agentLeaderService.js`
- `services/medicalAnalysisService.js`
- `services/reminderScheduleService.js`

Frontend (`frontend/src`):
- `components/agents/DrugWarningCard.tsx`
- `components/agents/SOAPNoteGenerator.tsx`
- `components/consultation/PatientSelect.tsx`
- `components/subscription/StripeCheckout.tsx`
- `components/ReportPreviewDemo.tsx` (demo/prototype)
- `components/ui/Loading.tsx` (`LoadingSpinner/Skeleton/Button` — never imported)
- `hooks/useApi.ts`
- `services/analyticsService.ts`
- `services/authService.ts`
- `services/consultationService.ts`
- `services/userService.ts`

AI service (`ai-service/app`):
- `services/gemini_service.py` — not imported by `main.py` or any service

Orphan asset:
- `frontend/src/i18n/locales/ur.json` — unused; i18n ships English only (`i18n/index.ts`)

### Internal development documentation / artifacts
- `FINAL_ROOT_CLEANUP_REPORT.md`, `INPUT_VALIDATION_IMPLEMENTATION_REPORT.md` (root)
- Entire `docs/` tree: `docs/legacy/`, `docs/planning/` (4 files), `docs/reports/` (15 files)
- `qa-screenshots/` (16 PNGs) — was already git-ignored; physically deleted

> These were process/QA notes with no runtime impact. All are recoverable from Git history.

---

## Folders Removed
- `docs/` (and `docs/legacy/`, `docs/planning/`, `docs/reports/`)
- `frontend/src/hooks/` (emptied)
- `frontend/src/components/subscription/` (emptied)
- `frontend/src/i18n/locales/` (emptied)
- `qa-screenshots/` (untracked)

---

## Dependencies Removed

### Frontend (`frontend/package.json`) — 7 removed
| Package | Reason |
| --- | --- |
| `@stripe/react-stripe-js` | Only used by the deleted `StripeCheckout` component; Stripe uses hosted redirect flow |
| `@stripe/stripe-js` | Same — no `loadStripe`/Elements usage anywhere |
| `@types/axios` | Deprecated stub; `axios` ships its own types |
| `date-fns` | No imports; dates handled via native `Date`/`utils/formatters` |
| `jspdf` | No imports; PDF generation is server-side (`pdfkit`) |
| `react-hook-form` | No imports; forms use local state + `utils/validation` |
| `zustand` | No imports; state via React Context (`AuthContext`) |

### Backend (`backend-node/package.json`) — 1 removed
| Package | Reason |
| --- | --- |
| `sharp` | No `require`/`import` anywhere; also removed a native build-script dependency |

Lock files were regenerated (`npm install`) and both projects re-verified after removal.

---

## Duplicate Code Removed
No unsafe automated merges were performed. One duplication was **identified and flagged**
(see Potential Issues): the `API_URL` / `shouldUseProxy` resolver is copy-pasted in
`services/apiFetch.ts` and four pages (`Analytics`, `FollowUps`, `NewConsultation`,
`PatientDetail`). It was left in place to avoid behavioral risk and is recommended as a
follow-up consolidation.

---

## Refactoring Performed
- **Merge/history repair** — reverted 39 files polluted by the botched merge to the clean
  working-branch state; removed all conflict markers.
- **Routing fix** — `SubscriptionManagement` page was imported but had **no route**, while
  `SubscriptionSuccess` linked to `/subscription`. Wired the existing page to the existing
  `/subscription` link (`ProtectedRoute` + `UserLayout`), fixing a broken link and an
  orphaned page. Also removed dead `Navigate`, `Sidebar`, `Header` imports from `App.tsx`.

Behavior was preserved throughout; no features were added.

---

## Build Verification
| Check | Result |
| --- | --- |
| Frontend `npm run build` (Vite) | ✅ Pass (2338 modules; CSS shrank after dead-component removal) |
| Frontend build after dependency pruning | ✅ Pass |
| Backend `npm install` | ✅ Pass (exit 0) |
| Backend `node --check` on all source files | ✅ 0 syntax errors |
| Backend full app module-graph load (`createApp`) | ✅ `APP_OK` — all routes/controllers/services resolve |
| AI service files match clean branch | ✅ 0 conflict markers |
| Final conflict-marker scan | ✅ 0 remaining |
| Working tree | ✅ Clean |

---

## Potential Issues (manual review recommended)
1. **Stripe billing portal URL is a hardcoded test placeholder** —
   `SubscriptionManagement.tsx` opens `https://billing.stripe.com/p/login/test_portal_${customerId}`,
   which is not a valid production portal URL. Proper fix needs a backend
   *Create Billing Portal Session* endpoint returning `session.url`. Left unchanged to avoid
   altering the payment flow.
2. **Manually constructed Stripe Checkout URL** — `subscriptionService.ts` builds
   `https://checkout.stripe.com/c/pay/${sessionId}` instead of using the `url` returned by
   Stripe's Checkout Session API. Recommend returning and using `session.url` from the backend.
3. **Duplicated `API_URL` resolver** — consolidate into a single exported helper in `apiFetch.ts`.
4. **Uploads use local disk** (`uploads/audio`, `uploads/reports`). Azure App Service storage is
   ephemeral outside `/home`. For durability/scale, move to **Azure Blob Storage** (feature-level change).
5. **Google Speech credentials** — `GOOGLE_APPLICATION_CREDENTIALS` points to a JSON file
   (`./secrets/google-speech.json`). Provision this secret in the target environment.
6. **ESLint hygiene** — ~72 `no-unused-vars` (mostly unused icon imports; tree-shaken, no bundle
   impact) and ~74 `no-explicit-any` remain. Safe to clean incrementally; not blocking deployment.
7. **`test` diagnostic routes retained** — `/api/test/openai*` are `super_admin`-only and useful
   for verifying OpenAI connectivity in production. Kept intentionally; remove if undesired.
8. **Large JS chunk** — main bundle ~866 kB (231 kB gzip). Consider route-level code-splitting.

---

## Azure Readiness Checklist

| Item | Status | Notes |
| --- | --- | --- |
| Production build | ✅ | `npm run build` produces `frontend/dist`; backend runs via `npm start` (`node src/server.js`) |
| Environment variables | ✅ | Centralized in `config/env.js` with required-var validation (`JWT_SECRET`, `MONGODB_URI`) |
| `process.env.PORT` support | ✅ | `PORT: Number(process.env.PORT || 5000)`; `server.listen(PORT)` binds all interfaces |
| MongoDB Atlas | ✅ | `MONGODB_URI` drives the connection; set to the Atlas SRV string in App Service settings |
| No hardcoded URLs/ports | ✅ (backend/frontend) | Frontend backend URL via `VITE_API_URL` with `/api` proxy fallback; ⚠️ Stripe URLs flagged above |
| No `localhost` assumptions in prod | ✅ | Prod defaults require explicit config; CORS throws if `CORS_ORIGIN` unset in production |
| Static assets | ✅ | Vite `dist/` served via container / static host |
| Logging | ✅ | `morgan` HTTP logs + structured `console` startup/lifecycle logs to Azure log stream |
| Graceful startup/shutdown | ✅ | `SIGTERM`/`SIGINT` handlers with 30s force-timeout; `uncaughtException`/`unhandledRejection` handled |
| Health endpoints | ✅ | `/health` and `/api/health` report DB connectivity (200/503) |
| Security | ✅ | `helmet` (CSP + HSTS in prod), env-locked CORS, global + auth rate limiting, JWT, Twilio webhook signature validation |
| Secrets management | ✅ | No secrets committed; only `.env.example` templates tracked; `.env*` and `secrets/` git-ignored |
| AI service (container) | ✅ | `uvicorn 0.0.0.0:8001`; set `WEBSITES_PORT=8001` for App Service for Containers |
| Deployment readiness | ✅ | `docker-compose.prod.yml` present; point `MONGODB_URI` at Atlas and disable any local Mongo service |

### Required App Service configuration (set as Application Settings)
- **backend-node:** `NODE_ENV=production`, `MONGODB_URI` (Atlas), `JWT_SECRET`, `CORS_ORIGIN`,
  `FRONTEND_URL`, `OPENAI_API_KEY`, `PYTHON_AI_SERVICE_URL`, plus Stripe/Twilio/Google keys as used.
- **ai-service:** `WEBSITES_PORT=8001`, `OPENAI_API_KEY`.
- **frontend:** `VITE_API_URL` set to the public backend URL at build time.

---

## Summary
- **40 files** and **4 folders** removed (15 dead source files, 1 orphan locale, 18 dev docs, plus screenshots).
- **8 npm dependencies** removed; lock files regenerated.
- **1 blocker fixed** (committed merge conflicts) and **1 broken route** repaired.
- Frontend builds, backend module graph loads, and no conflict markers remain.

The codebase is now lean, coherent, and ready for Azure App Service + MongoDB Atlas, with a
short list of clearly documented follow-ups (primarily the Stripe portal/checkout URL handling).
