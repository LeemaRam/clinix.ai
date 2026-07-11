# i18n Legacy Cleanup Report

## Files moved
- `frontend/src/i18n/locales/en.json` -> `frontend/src/i18n/locales/legacy/en.json`
- `frontend/src/i18n/locales/ur.json` -> `frontend/src/i18n/locales/legacy/ur.json`

## Whether old files had any imports
- Checked `frontend/src` for:
  - `i18n/locales`
  - `locales/en.json`
  - `locales/ur.json`
  - import patterns ending in `en.json` / `ur.json`
- Result: **no active imports/usages found** in frontend source files.

## Active i18n file confirmed
- `frontend/src/i18n/index.ts` imports:
  - `../locales/en/translation.json`
- Active translation source remains:
  - `frontend/src/locales/en/translation.json`

## Build result
- Command: `npm run build` (in `frontend`)
- Result: **passed** (Vite production build completed successfully)

## Lint result
- Command: `npm run lint` (in `frontend`)
- Result: **failed** with pre-existing lint issues
  - Summary from run: `196 problems (177 errors, 19 warnings)`
  - No lint fixes were applied (per instruction not to fix unrelated issues).

## Remaining i18n issues
- Urdu remains selectable in UI in some places while only English resource is currently wired through `frontend/src/locales/en/translation.json`.
- Legacy locale JSON files are now archived under `frontend/src/i18n/locales/legacy/` and no longer sit in the main legacy folder root.

## Suggested commit command
```bash
git add frontend/src/i18n/locales/legacy/en.json frontend/src/i18n/locales/legacy/ur.json frontend/src/i18n/locales/en.json frontend/src/i18n/locales/ur.json I18N_LEGACY_CLEANUP_REPORT.md && git commit -m "chore(i18n): archive unused legacy locale json files"
```
