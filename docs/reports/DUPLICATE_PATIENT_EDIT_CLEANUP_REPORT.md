# Duplicate Patient Edit Cleanup Report

## Which file is active
- Active page: `frontend/src/pages/PatientEdit.tsx`
- Verified in `frontend/src/App.tsx`:
  - Import: `import PatientEdit from './pages/PatientEdit';`
  - Route: `/patients/:id/edit` renders `<PatientEdit />`

## Which file was archived
- Archived file:
  - `frontend/src/pages/EditPatient.tsx` -> `frontend/src/pages/_archive/EditPatient.tsx`

## Search results summary
- Repo search terms run:
  - `EditPatient`
  - `PatientEdit`
  - `./pages/EditPatient`
  - `./pages/PatientEdit`
- Results:
  - `./pages/PatientEdit` is imported in `frontend/src/App.tsx`
  - `EditPatient` had no active route/component imports in source routing
  - `EditPatient` references were found in docs/reports, not active routing usage

## Files moved/changed
- Moved:
  - `frontend/src/pages/EditPatient.tsx` -> `frontend/src/pages/_archive/EditPatient.tsx`
- Added:
  - `DUPLICATE_PATIENT_EDIT_CLEANUP_REPORT.md`
- Not modified:
  - `frontend/src/pages/PatientEdit.tsx`
  - `frontend/src/App.tsx` routing logic

## Build result
- Command: `cd frontend && npm run build`
- Result: **Passed** (Vite build completed successfully)

## Lint result
- Command: `cd frontend && npm run lint`
- Result: **Failed** due to pre-existing lint issues in multiple files (including existing project-wide TypeScript/ESLint violations)
- No unrelated lint fixes were applied.

## Remaining risks
- Archived page remains inside frontend source tree (`frontend/src/pages/_archive/`), so lint still scans it and reports legacy issues from that file.
- If the team wants lint-clean CI later, they may need to exclude `_archive` from lint scope or remove archived files in a separate approved cleanup.

## Suggested commit command
```bash
git add frontend/src/pages/_archive/EditPatient.tsx frontend/src/pages/EditPatient.tsx DUPLICATE_PATIENT_EDIT_CLEANUP_REPORT.md && git commit -m "chore(frontend): archive orphan EditPatient page"
```
