# Cleanup Implementation Report — Clinix.ai

**Project:** Clinix.ai  
**Root:** `D:\clinixai-stage`  
**Date:** 2026-05-31  
**Source of truth:** `DEAD_CODE_AND_BLOAT_AUDIT.md` §6 Table A (Safe to delete now)  
**Scope:** Safe cleanup only. No dependency removals, no backend/frontend active logic changes, no `.env` touched, **not committed**.

---

## Pre-flight verification

| Check | Result |
|---|---|
| Active services in `docker-compose.yml` | `ai-service`, `backend` (`backend-node`), `frontend` only |
| Active services in `start-local.ps1` | `ai-service`, `backend-node`, `frontend` only |
| `backend-legacy/` referenced by compose/start script | **No** — docs only; **not removed** (Table B, requires separate approval) |
| `EditPatient` / `_archive` imported in `App.tsx` | **No** — only `PatientEdit` is routed |
| Legacy i18n imported in `frontend/src/i18n/index.ts` | **No** — only `../locales/en/translation.json` is loaded |
| Root `ApiError.js` imported by backend | **No** — active copy is `backend-node/src/utils/ApiError.js` (ESM) |

---

## Files deleted (Table A — 12 items)

| File / path | Why safe |
|---|---|
| `temp_diff.txt` | Scratch diff artifact; zero code imports or script references. |
| `ApiError.js` (repo root) | Stray CommonJS duplicate; backend uses `backend-node/src/utils/ApiError.js`. |
| `ai-service/temp_transcribe_test.wav` | Manual test media; not referenced by `ai-service/app/**`. |
| `ai-service/test_transcribe.py` | Ad hoc scratch script; not in Docker/start scripts. |
| `ai-service/transcribe_test.py` | Duplicate ad hoc scratch script. |
| `ai-service/tts.ps1` | One-off helper referencing deleted test wav; not wired to app. |
| `ai-service/package-lock.json` | Orphan Node lockfile; no `ai-service/package.json` exists. |
| `frontend/src/pages/_archive/EditPatient.tsx` | Confirmed orphan; `PatientEdit.tsx` is the routed page in `App.tsx`. |
| `frontend/src/i18n/locales/legacy/en.json` | Legacy locale tree; not imported by `i18n/index.ts`. |
| `frontend/src/i18n/locales/legacy/ur.json` | Same as above. |
| `frontend/dist/` | Regenerable Vite build output; removed then rebuilt successfully. |
| `.venv/` (repo root) | Stray Python venv; only `ai-service/.venv` is used by `start-local.ps1`. **Did not touch `ai-service/.venv`.** |

### Empty directories removed after file deletion

- `frontend/src/pages/_archive/`
- `frontend/src/i18n/locales/legacy/`
- `frontend/src/i18n/locales/` (empty after legacy removal)

---

## Files moved

**None.** Table B archive/move items were intentionally skipped (requires separate approval).

---

## `.gitignore` changes

Added to root `.gitignore`:

```gitignore
# Local QA / scratch artifacts
qa-screenshots/
temp_diff.txt

# Generated frontend build output
frontend/dist/

# Test / scratch audio in ai-service (runtime uploads use backend-node/uploads/)
ai-service/temp_*.wav
```

Already present (unchanged): `.venv/`, `node_modules/`, `uploads/`, `backend-node/uploads/`, `.env`.

**Note:** `qa-screenshots/` was **not deleted** — only gitignored per audit Table B recommendation and user instructions.

---

## Build / test results

### Frontend build

```
cd frontend && npm run build
✓ 2337 modules transformed.
✓ built in 7.81s
```

**Result: PASS**

### Backend syntax checks (no backend source edited; sanity check only)

```
node --check backend-node/src/app.js   → exit 0
node --check backend-node/src/server.js → exit 0
```

**Result: PASS**

---

## Files intentionally kept

| Item | Reason |
|---|---|
| `backend-legacy/` | Table B (archive/move) — not Table A; user approval required |
| `qa-screenshots/` | Table B — kept locally, now gitignored |
| All `*_REPORT.md` / `*_PLAN.md` docs at root | Table B — documentation history, not safe-delete |
| `frontend/src/pages/PatientEdit.tsx` | Active routed page |
| `frontend/src/locales/en/translation.json` | Active i18n source |
| `ai-service/app/**`, `backend-node/src/**`, active frontend pages/components | Active application code |
| `ai-service/.venv/` | Active local Python environment for AI service |
| `backend-node/uploads/` | Runtime generated media (gitignored) |
| Unused npm deps (`zustand`, `jspdf`, etc.) | Table D — manual review required |

---

## Files still needing manual review (Table D — not touched)

1. `zustand`, `jspdf`, `react-hook-form`, `date-fns`, `@types/axios` (frontend deps)
2. `sharp` (backend dep)
3. `react-icons` vs `lucide-react` consolidation
4. `ai-service` `/extract-followup`, `/send-reminder` endpoints
5. `backend-node` test/debug routes and Whisper fallback double-billing path
6. `backend-legacy/` archival (Table B)
7. Root documentation sprawl → `docs/archive/` (Table B)
8. Large page/controller refactors (Sessions 4–5 in audit plan)

---

## Active app runtime status

Cleanup did not modify any active service source. Health probes at implementation time:

- **Frontend** (`http://localhost:3000`): not running in this session (no dev server started here)
- **Backend** (`http://localhost:5000/health`): not running in this session
- **AI service** (`http://localhost:8001/health`): not running in this session

The stack was not restarted during cleanup. Based on unchanged active code paths and a passing frontend build + backend syntax checks, **the active app is expected to run unchanged** after `.\start-local.ps1` or manual service startup.

---

## Suggested commit command (do NOT run until approved)

Commit **only** the cleanup-related paths (exclude unrelated UI polish WIP unless you want one combined commit):

```powershell
git add .gitignore `
  temp_diff.txt `
  ApiError.js `
  ai-service/package-lock.json `
  ai-service/temp_transcribe_test.wav `
  ai-service/test_transcribe.py `
  ai-service/transcribe_test.py `
  ai-service/tts.ps1 `
  frontend/src/pages/_archive/EditPatient.tsx `
  CLEANUP_IMPLEMENTATION_REPORT.md

git commit -m "$(cat <<'EOF'
chore(cleanup): remove dead temp files, archived orphans, and stray artifacts

Deletes audit Table A items (scratch diff, test wav/scripts, root ApiError,
orphan EditPatient page, legacy i18n JSON) and gitignores qa-screenshots,
temp_diff, frontend/dist, and ai-service temp wav files.
EOF
)"
```

> Legacy locale JSON under `frontend/src/i18n/locales/legacy/` was untracked (`??`) before deletion, so it will not appear in `git status` as deleted — only the on-disk cleanup applies.

---

## Summary

- **Deleted:** 12 Table A targets + 3 empty directories  
- **Moved:** 0  
- **`.gitignore`:** updated (4 new patterns/sections)  
- **Build:** PASS  
- **Backend check:** PASS  
- **Committed:** No (awaiting approval)
