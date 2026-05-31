# Clinix.ai — UI/UX Audit Report

**Scope:** `frontend/` (React + TypeScript + Vite + Tailwind CSS)
**Mode:** Read-only inspection. No code changes were made.
**Date:** 2026-05-31
**Reviewer:** Senior UI/UX + Frontend audit pass

---

## 0. Executive Summary

The frontend is functionally rich and uses a thoughtful Tailwind design-token base (`primary`, `secondary`, `accent`, `success`, `warning`, `error` in [tailwind.config.js](frontend/tailwind.config.js)), but it is undermined by a **broken i18n pipeline** that is the single root cause of most "weird text" symptoms the team has observed in screenshots:

- `auth.forgotPasswordHelp`, `auth.backToSignIn` rendering as raw keys
- "3. RECORDING TYPE" / "CONSULTATION.RECORDINGTYPE"-style header noise
- "transcriptionreview", "Role aware", "P atient", "cons ultation", "Do ctor" — these are raw camelCase/dotted i18n keys rendered through `uppercase` + `tracking-wider` table headers and badges, which CSS can wrap mid-key into visually broken word fragments

A secondary cluster of issues concerns inconsistent buttons, hardcoded color classes that bypass the design tokens, two duplicate Patient-edit pages, very large page components, and inconsistent date formatting.

**Totals:** 47 distinct findings across 7 categories — **3 Critical, 12 High, 22 Medium, 10 Low**.

**Code files modified during this audit:** **No.**

---

## 1. Root-Cause Finding (read this first)

### F-001 — i18n pipeline is broken end-to-end  [CRITICAL]

**Files:**
- [frontend/src/i18n/index.ts](frontend/src/i18n/index.ts#L5-L6)
- [frontend/src/locales/en/translation.json](frontend/src/locales/en/translation.json)

**Evidence:**
```ts
// frontend/src/i18n/index.ts
import en from './locales/en.json';   // ← file does NOT exist
import ur from './locales/ur.json';   // ← file does NOT exist
```
The only translation file that exists is [frontend/src/locales/en/translation.json](frontend/src/locales/en/translation.json), and it contains only **11 keys** (a `patients` sub-tree and three `common` keys).

Across the app, `t('…')` is called with **150+ distinct keys** across namespaces `auth`, `consultation`, `transcription`, `reports`, `dashboard`, `subscription`, `settings`, `navigation`, `superAdmin`, `errors`, `speech`, `patients`, `common`.

**Why it matters:**
- When the imports above fail, i18next falls back to returning the key string itself. That is *exactly* what users see in screenshots: `auth.forgotPasswordHelp`, `auth.backToSignIn`, etc.
- When those raw keys are placed inside table headers / badges with `uppercase tracking-wider` (e.g. [Dashboard.tsx:494](frontend/src/pages/Dashboard.tsx#L494)), the browser wraps mid-key and the `letter-spacing` produces visual gaps. That is the source of:
  - `consultation.recordingType` → "CONSULTATION. RECORDING TYPE" → trimmed in screenshot as "3. RECORDING TYPE"
  - `transcription.review` → "TRANSCRIPTION REVIEW" with no separator → "transcriptionreview"
  - `roleAware`, `patient`, `consultation`, `doctor` → "Role aware", "P atient", "cons ultation", "Do ctor" (uppercase + tracking-wider + narrow column = mid-word wrap)
- Multilingual support (English/Urdu) is non-functional.

**Recommended fix (safe, isolated):**
1. Either (a) create the missing files `frontend/src/locales/en.json` and `frontend/src/locales/ur.json`, **or** (b) change [i18n/index.ts](frontend/src/i18n/index.ts) to import the existing path:
   ```ts
   import en from './locales/en/translation.json';
   ```
2. Backfill the translation JSON with the full key set actually used in code (see Appendix A for the namespace list).
3. Enable `returnEmptyString: false` and `saveMissing: true` in dev so missing keys are loud, not silent.
4. Remove the `t('…') || 'fallback'` anti-pattern (see F-005) once keys are populated.

**Safe to fix now:** Yes. **Effort:** M (4–8 h to translate, 30 min to wire).

---

## 2. Visual Design

### F-010 — Dark sidebar vs. light content balance is fine; collapsed-state spacing is brittle  [Medium]
**File:** [frontend/src/components/layout/Sidebar.tsx](frontend/src/components/layout/Sidebar.tsx#L85-L91)

Collapsed mode toggles `gap-3` off and conditionally hides the label:
```tsx
<span className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
  <item.icon className="h-5 w-5 shrink-0" />
  {!isCollapsed && <span>{item.name}</span>}
</span>
```
Issues: no tooltip is shown when collapsed (only `title` if present), and the `px-*` of the row does not change, so icons are off-center within the collapsed rail. **Fix:** Add a real tooltip (`@radix-ui/react-tooltip` or a small custom one), and apply `justify-center` + symmetric horizontal padding when `isCollapsed`. **Safe:** Yes. **Effort:** S.

### F-011 — Button styling is inconsistent across pages  [High]
Defined utility classes (`btn-primary`, `btn-secondary`, etc.) exist in [frontend/src/index.css](frontend/src/index.css), but several pages bypass them with hardcoded color palettes:

| File | Line | Snippet | Issue |
|---|---|---|---|
| [Pricing.tsx](frontend/src/pages/Pricing.tsx#L180) | 180 | `btn-primary bg-emerald-700` | Overrides design token |
| [BookAppointment.tsx](frontend/src/pages/BookAppointment.tsx#L76) | 76 | `bg-green-600 hover:bg-green-700` | Raw palette |
| [BookAppointment.tsx](frontend/src/pages/BookAppointment.tsx#L132) | 132 | `bg-blue-600 text-white py-3` | Raw palette |
| [FollowUps.tsx](frontend/src/pages/FollowUps.tsx#L165) | 165 | `bg-blue-600 hover:bg-blue-700` | Raw palette |
| [Appointments.tsx](frontend/src/pages/Appointments.tsx#L118-L119) | 118-119 | `bg-green-600 / bg-red-600` | Raw palette |

**Fix:** Force `btn-primary | btn-secondary | btn-danger | btn-ghost` everywhere; add ESLint rule banning raw `bg-(blue|green|red|emerald|amber)-(\d00)` on `<button>` elements. **Safe:** Yes. **Effort:** M.

### F-012 — Color tokens defined but unused  [Medium]
[tailwind.config.js](frontend/tailwind.config.js) defines `primary/secondary/accent/success/warning/error`. Pages use `blue-*`, `green-*`, `red-*`, `emerald-*`, `yellow-*` instead. Replace `blue→accent`, `green→success`, `red→error`, `amber→warning`, `emerald→primary`.

### F-013 — Card sizes and gaps inconsistent  [Low]
Dashboard stat cards use `gap-4` and arbitrary `py-3 px-6`; Analytics cards use `gap-6 p-6`; Patients list cards use `gap-3 p-4`. Standardize on a single `card` utility from index.css (`p-6 gap-4 rounded-2xl`).

### F-014 — Whitespace imbalance on Reports / Analytics / FollowUps  [Low]
These pages center a narrow content column inside a full-width main area, producing the "too much whitespace" feeling from the screenshots. Set `max-w-7xl mx-auto` consistently and remove the inner `max-w-3xl` wrappers.

### F-015 — Typography scale not enforced  [Low]
H1/H2 sizes drift: Dashboard uses `text-2xl font-bold`, Analytics `text-3xl font-semibold`, Reports `text-xl font-bold`. Define `h1/h2/h3` component classes in index.css and apply.

### F-016 — Icon usage inconsistent  [Low]
Mix of `lucide-react` and inline SVG (see [Pricing.tsx](frontend/src/pages/Pricing.tsx) check marks vs. [Appointments.tsx](frontend/src/pages/Appointments.tsx) Heroicons-style). Pick one set.

### F-017 — Table header `uppercase tracking-[0.12em]` + raw i18n keys = mid-word wrap  [High]
Already covered by F-001 root cause, but flagged again because even after i18n is fixed, very narrow columns (e.g. status badges in `PastConsultations`) can still mid-wrap normal English words like "Recording". Add `whitespace-nowrap` to `<th>` cells or reduce `tracking` to `0.05em`.

---

## 3. Content & Copywriting

### F-020 — Raw translation keys leaking to UI  [Critical]
Symptom of F-001. Concrete examples that will disappear once F-001 is fixed:
- Login: `auth.forgotPasswordHelp`, `auth.backToSignIn`, `auth.enterEmailToReset`, `auth.forgotPasswordSent`
- Register: `auth.passwordsDoNotMatch`, `auth.fullNameRequired`, `auth.registrationFailed`
- Dashboard: `dashboard.dashboardOverview`, `dashboard.totalPatients`, `consultation.recordingType`
- Subscription: `subscription.pleaseLoginToContinue`, `subscription.unexpectedErrorOccurred`
- Pricing: `superAdmin.errorFetchingPlans`, `superAdmin.chooseYourPlan`, `superAdmin.monthly`

### F-021 — `t('…') || 'English fallback'` anti-pattern  [High]
**Files & lines:**
- [Login.tsx:62](frontend/src/pages/Login.tsx#L62)
- [Login.tsx:69](frontend/src/pages/Login.tsx#L69)
- [Login.tsx:154](frontend/src/pages/Login.tsx#L154)
- [Login.tsx:230](frontend/src/pages/Login.tsx#L230)

Once i18n is wired (F-001), drop all `|| '…'` fallbacks — they hide regressions and produce inconsistent copy depending on which key was authored.

### F-022 — Hardcoded English literals never reach i18n  [High]
Examples:
- [Login.tsx:131](frontend/src/pages/Login.tsx#L131) — marketing tagline
- [Pricing.tsx:237](frontend/src/pages/Pricing.tsx#L237) — "Contact sales"
- [Pricing.tsx:253-L278](frontend/src/pages/Pricing.tsx#L253-L278) — Enterprise FAQ block
- [FollowUps.tsx:116](frontend/src/pages/FollowUps.tsx#L116) — "Follow-up Management"
- [FollowUps.tsx:153](frontend/src/pages/FollowUps.tsx#L153) — "Reminder sent:"
- [FollowUps.tsx:168](frontend/src/pages/FollowUps.tsx#L168) — "Send Reminder"
- [Appointments.tsx:93](frontend/src/pages/Appointments.tsx#L93), [L96](frontend/src/pages/Appointments.tsx#L96), [L113](frontend/src/pages/Appointments.tsx#L113)
- [BookAppointment.tsx:51](frontend/src/pages/BookAppointment.tsx#L51), [L63-L89](frontend/src/pages/BookAppointment.tsx#L63-L89)
- [Analytics.tsx:96](frontend/src/pages/Analytics.tsx#L96), [L101-L121](frontend/src/pages/Analytics.tsx#L101-L121), [L144-L162](frontend/src/pages/Analytics.tsx#L144-L162)
- [Reports.tsx:46](frontend/src/pages/Reports.tsx#L46) — "Failed to load reports" in `catch`

### F-023 — Inconsistent capitalization & punctuation in button labels  [Medium]
"Send Reminder", "Confirm", "Cancel", "Contact sales" coexist with "Save", "Saving...", "Send reminder". Adopt Title Case for actions and remove trailing punctuation.

### F-024 — Placeholder text mixes voice  [Low]
Compare [translation.json](frontend/src/locales/en/translation.json) "Enter your note here..." vs. various search inputs that use "Search…" (different ellipsis). Standardize on the Unicode ellipsis (`…`).

### F-025 — Empty states are inconsistent  [Medium]
Analytics shows "No data available" but still renders empty chart axes (Recharts). Reports/Patients use a single line "No records yet". Define a single `<EmptyState icon title description action />` component and use it everywhere.

### F-026 — Date "5/31/2026" comes from `toLocaleDateString()` on a future-dated record  [Low]
The 2026 dates are produced by seeded test data, but the M/D/YYYY format itself is locale-dependent. See F-040.

---

## 4. Input & Form Quality

### F-030 — No shared validation library  [High]
Every form re-implements validation by hand:
- [Register.tsx:33-L37](frontend/src/pages/Register.tsx#L33-L37) (password match)
- [Patients.tsx:140-L148](frontend/src/pages/Patients.tsx#L140-L148)
- [EditPatient.tsx:102-L134](frontend/src/pages/EditPatient.tsx#L102-L134)
- [NewConsultation.tsx:369-L602](frontend/src/pages/NewConsultation.tsx#L369-L602)
- [BookAppointment.tsx:29-L32](frontend/src/pages/BookAppointment.tsx#L29-L32)

Missing: password complexity rules, phone-number format, email regex (relies on browser `type="email"` only), file-size/MIME enforcement on upload, consultation-consent validation surfaced before submit. **Fix:** Adopt `react-hook-form` + `zod`; create a `validators/` module with `patientSchema`, `consultationSchema`, etc.

### F-031 — Required-field markers missing or inconsistent  [Medium]
[BookAppointment.tsx:63-L89](frontend/src/pages/BookAppointment.tsx#L63-L89) uses literal `*` in label strings; other pages rely on `required` attribute only with no visual cue.

### F-032 — Error message placement varies  [Medium]
Some forms use inline `<p className="text-red-500">`, others toast only, others both. Adopt: inline below field for validation, toast for server/network errors.

### F-033 — Disabled-button state is decorative, not enforced  [Medium]
Several "Submit" buttons set `disabled={loading}` but still call the handler if a user double-clicks before React re-renders. Ensure handlers guard with a local `isSubmitting` ref.

### F-034 — Loading & success states inconsistent  [Low]
`Saving...` (with trailing dots) appears in some buttons; others swap to a spinner; others show nothing. Standardize on a `<ButtonSpinner />` and i18n key `common.saving`.

### F-035 — Search input has no debounce  [Medium]
[Patients.tsx](frontend/src/pages/Patients.tsx) and [PastConsultations.tsx](frontend/src/pages/PastConsultations.tsx) re-filter on every keystroke against the full list; with large datasets this is slow. Add `useDebouncedValue(query, 200)`.

### F-036 — Upload validation weak  [High]
[NewConsultation.tsx](frontend/src/pages/NewConsultation.tsx) accepts audio files but does not enforce: max size, MIME whitelist (`audio/wav|mp3|m4a|webm`), or duration cap. Backend already imposes a limit — surfacing it client-side prevents wasted uploads.

### F-037 — Consultation consent toggle is not blocking submit  [High]
Confirm in [NewConsultation.tsx](frontend/src/pages/NewConsultation.tsx) flow that `consent` is part of the validation schema (not just a UI checkbox). If a user can submit without consent being `true`, that is a compliance issue for medical recordings.

---

## 5. Accessibility

### F-040 — Icon-only buttons lack `aria-label`  [High]
Where good: [Sidebar.tsx:63](frontend/src/components/layout/Sidebar.tsx#L63), [Header.tsx:67](frontend/src/components/layout/Header.tsx#L67) (✓).
Where missing:
- [PastConsultations.tsx:1030-L1052](frontend/src/pages/PastConsultations.tsx#L1030-L1052) — view/download/delete icons have `title` but no `aria-label`
- [Reports.tsx](frontend/src/pages/Reports.tsx) row-action icons
- [Dashboard.tsx](frontend/src/pages/Dashboard.tsx) "more" / "expand" icons

### F-041 — Charts have no text alternative  [Medium]
Recharts SVGs in [Analytics.tsx](frontend/src/pages/Analytics.tsx) have no `role="img"` or `aria-label` summarizing the data; screen-reader users get nothing. Add an `<sr-only>` summary list.

### F-042 — Focus states rely on browser default  [Medium]
`index.css` does not define a focus ring utility used consistently. Add `focus-visible:ring-2 focus-visible:ring-primary-500` to `btn`/`input` base classes.

### F-043 — `<label htmlFor>` linkage spotty  [Medium]
[Login.tsx:174-L177](frontend/src/pages/Login.tsx#L174-L177) and [Register.tsx:108-L159](frontend/src/pages/Register.tsx#L108-L159) link correctly. [EditPatient.tsx](frontend/src/pages/EditPatient.tsx) uses `<label>` wrapping but inputs sometimes have no `id`; audit before fixing.

### F-044 — Color contrast on disabled buttons  [Low]
`bg-gray-200 text-gray-400` falls below WCAG AA 4.5:1. Use `bg-secondary-200 text-secondary-700`.

### F-045 — No skip-to-content link  [Low]
Add `<a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a>` in [App.tsx](frontend/src/App.tsx) layout.

### F-046 — Heading order skipped on Pricing / Analytics  [Low]
Pages jump from H1 → H3 (no H2 between section titles). Use semantic levels.

---

## 6. Responsive Design

### F-050 — Long tables on mobile overflow without horizontal-scroll affordance  [High]
[Dashboard.tsx:492](frontend/src/pages/Dashboard.tsx#L492) renders an unguarded `<table>`. On <640 px the page horizontally scrolls the entire body. Wrap in `<div className="overflow-x-auto -mx-4 md:mx-0">`.

### F-051 — Cards don't wrap on tablet breakpoint  [Medium]
Stat cards use `grid grid-cols-4` on Dashboard; collapses awkwardly to a single column at `md`. Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.

### F-052 — Sidebar overlay missing on mobile  [Medium]
On mobile the sidebar opens but no semi-transparent overlay closes it on outside-click. Add `<div className="fixed inset-0 bg-black/40 md:hidden" onClick={close} />`.

### F-053 — Forms exceed viewport width on mobile  [Medium]
[NewConsultation.tsx](frontend/src/pages/NewConsultation.tsx) uses fixed `w-[640px]` panels in places. Switch to `max-w-2xl w-full`.

### F-054 — Pricing cards stack vertically with huge gaps  [Low]
Use `grid grid-cols-1 md:grid-cols-3 gap-6` and remove inner `mt-12` spacers.

---

## 7. UX Flow

### F-060 — Login → forgot-password flow shows raw keys  [Critical]
Already covered by F-001 / F-020. Confirm forgot-password POST endpoint matches backend.

### F-061 — Register → no email verification step  [Medium]
After successful register, user is logged in immediately. Consider a "verify your email" intermediate state — at minimum show a confirmation toast and route to dashboard, not silently.

### F-062 — Patient creation flow duplicates pages  [High]
Both [EditPatient.tsx](frontend/src/pages/EditPatient.tsx) (379 LOC) and [PatientEdit.tsx](frontend/src/pages/PatientEdit.tsx) (505 LOC) exist. Confirm which is wired in routing (see [App.tsx](frontend/src/App.tsx)) and delete the other. Risk: silent drift between them.

### F-063 — New consultation: consent → upload step ordering  [High]
Currently a user can pick an audio file before checking consent. Reverse: consent first, then upload becomes enabled.

### F-064 — Report preview/download doesn't indicate progress on large PDFs  [Medium]
PDF generation happens client-side in [Dashboard.tsx](frontend/src/pages/Dashboard.tsx) and [PastConsultations.tsx](frontend/src/pages/PastConsultations.tsx); for long reports the UI freezes. Add a spinner + disable trigger.

### F-065 — Appointment/follow-up flow lacks confirmation modal on Cancel  [Medium]
[Appointments.tsx:118-L119](frontend/src/pages/Appointments.tsx#L118-L119) cancels immediately. Wrap with `confirm()` or a modal.

### F-066 — Pricing → subscription redirect doesn't preserve plan context  [Low]
On Stripe redirect failure, user lands back on Pricing with no toast about which plan failed.

### F-067 — Settings flow: no "unsaved changes" guard  [Low]
Navigating away from [Settings.tsx](frontend/src/pages/Settings.tsx) with dirty form loses input silently.

---

## 8. Technical Frontend Issues

### F-070 — Two duplicate Patient-edit components  [High]
See F-062.

### F-071 — Page components are too large  [Medium]
- [NewConsultation.tsx](frontend/src/pages/NewConsultation.tsx) ≈ 1300 LOC
- [PastConsultations.tsx](frontend/src/pages/PastConsultations.tsx) ≈ 1200 LOC
- [PatientDetail.tsx](frontend/src/pages/PatientDetail.tsx) ≈ 800+ LOC
- [Dashboard.tsx](frontend/src/pages/Dashboard.tsx) ≈ 650 LOC

Extract modals, PDF generators, and consultation sub-steps into `components/consultation/*` and `components/reports/*`.

### F-072 — Inconsistent API error handling in services  [Medium]
[frontend/src/services/](frontend/src/services/) — some services throw, some return `{ok:false}`, some swallow. Adopt a single `request()` wrapper that always throws `ApiError` with `{status, code, message}` and centralize toast in a `useApiError` hook.

### F-073 — Date formatting scattered  [Medium]
`new Date(x).toLocaleDateString()` and `.toLocaleString()` are duplicated in:
- [FollowUps.tsx:147, L151](frontend/src/pages/FollowUps.tsx#L147)
- [Appointments.tsx:108, L113](frontend/src/pages/Appointments.tsx#L108)
- [Dashboard.tsx:190](frontend/src/pages/Dashboard.tsx#L190)
- [PatientDetail.tsx:354](frontend/src/pages/PatientDetail.tsx#L354)
- [NewConsultation.tsx:1139](frontend/src/pages/NewConsultation.tsx#L1139)

Create `frontend/src/utils/date.ts` exposing `formatDate`, `formatDateTime`, `formatIsoDay`.

### F-074 — Repeated Tailwind class clusters  [Low]
The card chrome `rounded-2xl border border-slate-200 bg-white shadow-sm` recurs 30+ times. Extract a `card` utility in [index.css](frontend/src/index.css).

### F-075 — Hardcoded strings that should use i18n  [High]
Comprehensive list under F-022.

### F-076 — Missing translation keys list  [Critical]
See Appendix A.

### F-077 — Unused / dead files (verify before deletion)  [Low]
Suspected: one of `EditPatient.tsx` vs `PatientEdit.tsx`. Confirm via router before removing.

### F-078 — `console.error` without user feedback  [Medium]
[FollowUps.tsx:45-L49](frontend/src/pages/FollowUps.tsx#L45-L49), [Appointments.tsx:56-L60](frontend/src/pages/Appointments.tsx#L56-L60), [Reports.tsx:56-L59](frontend/src/pages/Reports.tsx#L56-L59).

### F-079 — Generic error messages  [Medium]
"Failed to load analytics", "Failed to load reports" — don't include backend code/correlation id, blocking debugging.

---

## 9. Per-Page Findings (quick reference)

| Page | Top concerns |
|---|---|
| Login | F-001 raw keys, F-021 fallback strings, F-022 hardcoded tagline |
| Register | F-030 manual validation, F-061 no verify step |
| Dashboard | F-017 table headers, F-050 mobile overflow, F-051 grid breakpoints, F-071 size |
| Patients | F-035 no search debounce, F-074 repeated card chrome |
| Patient Detail | F-073 date duplication, F-071 size |
| Edit/PatientEdit | F-062 duplicate page |
| New Consultation | F-036 weak upload validation, F-037 consent gating, F-063 step order, F-071 size |
| Past Consultations | F-040 missing aria-label, F-064 PDF freeze, F-071 size |
| Reports | F-022 hardcoded copy, F-079 generic errors |
| Analytics | F-025 empty state still renders chart, F-041 chart a11y, F-022 hardcoded copy |
| Follow-Ups | F-022 hardcoded copy, F-073 date format |
| Appointments | F-011 raw color buttons, F-065 no cancel confirm |
| Book Appointment | F-022 hardcoded labels, F-011 raw colors |
| Pricing | F-011 emerald override, F-022 FAQ block |
| Settings | F-067 unsaved-changes guard |
| Sidebar/Header | F-010 collapsed tooltip, F-052 mobile overlay |

---

## 10. Top 10 UI/UX Fixes To Do First

1. **F-001** Fix the i18n import path or create the missing `en.json`/`ur.json`. (eliminates ~80% of "weird text" the team is seeing)
2. **F-076 / Appendix A** Backfill missing translation keys for all namespaces.
3. **F-050** Wrap all `<table>` in horizontally-scrollable containers.
4. **F-052** Add mobile sidebar overlay + outside-click close.
5. **F-051** Replace `grid-cols-4` with responsive `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
6. **F-010** Add tooltips in collapsed sidebar, center icons.
7. **F-011** Convert raw `bg-blue/green/red-*` button colors to `btn-primary`/`btn-secondary`/`btn-danger`.
8. **F-017** Add `whitespace-nowrap` and reduce `tracking-[0.12em]` on `<th>` to prevent mid-word wrap.
9. **F-025** Build one `<EmptyState>` component; stop rendering empty Recharts axes.
10. **F-062 / F-070** Delete the unused duplicate of `EditPatient` vs `PatientEdit`.

## 11. Top 10 Content / Copy Fixes

1. Remove all `t('…') || 'English fallback'` after i18n is fixed (F-021).
2. Move marketing tagline on Login to i18n (F-022).
3. Move Pricing "Contact sales" and FAQ block to i18n (F-022).
4. Move FollowUps strings (`Follow-up Management`, `Reminder sent:`, `Send Reminder`) to i18n.
5. Move Appointments strings (`Booked on:`, `Confirm`, `Cancel`, `Appointments`) to i18n.
6. Move Analytics card and chart titles to i18n.
7. Move BookAppointment form labels and error messages to i18n.
8. Move Reports `Failed to load reports` to `t('reports.failedToLoad')`.
9. Standardize button case (Title Case) and remove trailing punctuation (no `Saving…` vs `Saving...`).
10. Replace `...` with `…` in placeholders globally.

## 12. Top 10 Validation Fixes

1. Adopt `react-hook-form` + `zod`; create `schemas/` (F-030).
2. Enforce password complexity (min 8, mixed-case, digit) in Register schema.
3. Confirm-password equality validator in Register.
4. Phone-number format validator in Patient / BookAppointment schemas.
5. Email regex (`zod.string().email()`) replacing browser-only `type="email"`.
6. File size + MIME whitelist for audio upload (F-036).
7. Block consultation submit unless consent === true (F-037).
8. Debounce search inputs (F-035).
9. Guard double-submit with `isSubmitting` ref (F-033).
10. Surface backend `error.message` instead of generic "Failed to …" (F-079).

## 13. Top 5 Responsive Fixes

1. Wrap all tables in `overflow-x-auto` (F-050).
2. Mobile sidebar overlay + close-on-outside (F-052).
3. Responsive grids: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (F-051).
4. Replace fixed-width `w-[640px]` panels in NewConsultation with `max-w-2xl w-full` (F-053).
5. Pricing cards `grid-cols-1 md:grid-cols-3` instead of stacked with `mt-12` (F-054).

## 14. Suggested Design System Improvements

- **Buttons:** `btn`, `btn-primary`, `btn-secondary`, `btn-danger`, `btn-ghost`, `btn-icon` (icon-only with built-in `aria-label` requirement).
- **Cards:** single `card`, `card-elevated`, `card-flat` utility in [index.css](frontend/src/index.css).
- **EmptyState:** shared component with `icon | title | description | action`.
- **PageHeader:** shared `<PageHeader title subtitle actions />` to standardize top of every page.
- **DataTable:** wraps `<table>` with mobile overflow, sortable headers, sticky header, no `tracking-[0.12em]` on narrow cells.
- **FormField:** wraps `<label htmlFor> + input + error message + help text` with consistent ARIA wiring.
- **Tooltip:** small Radix-based wrapper for collapsed sidebar + icon buttons.
- **Toast helpers:** `toastApiError(err)` central util.
- **Date utils:** `formatDate / formatDateTime / formatRelative` in `utils/date.ts`.
- **Color tokens only:** ESLint rule banning raw `bg-(blue|green|red|emerald|amber|yellow)-\d00`.

## 15. Suggested Implementation Order

**Phase 1 — Stop the bleeding (1–2 days)**
1. F-001 i18n wiring + Appendix A key backfill.
2. F-021 remove fallback `||` strings.
3. F-050 / F-051 / F-052 mobile responsive fixes (table overflow, grid breakpoints, sidebar overlay).
4. F-062 delete the unused Patient edit duplicate.

**Phase 2 — Visual consistency (2–4 days)**
5. Introduce design-system primitives (Button, Card, EmptyState, PageHeader, DataTable, FormField).
6. F-011 / F-012 sweep pages to use new primitives + tokens.
7. F-073 centralize date formatting.

**Phase 3 — Validation & a11y (3–5 days)**
8. F-030 adopt react-hook-form + zod, migrate forms page-by-page (Register → Patient → Consultation → BookAppointment).
9. F-040 / F-041 / F-042 / F-043 / F-045 accessibility pass.

**Phase 4 — Flow polish (2–3 days)**
10. F-061, F-063, F-064, F-065, F-067 UX flow refinements.
11. F-071 extract sub-components from oversized pages.

**Phase 5 — Hardening (ongoing)**
12. F-072 unified API error handling.
13. ESLint rules + Storybook for the new primitives.
14. Translation pipeline + missing-key CI guard.

---

## Appendix A — Missing Translation Keys (Namespace List)

The following namespaces are referenced by `t('namespace.key')` calls but absent from [frontend/src/locales/en/translation.json](frontend/src/locales/en/translation.json). They must be authored as part of F-001.

| Namespace | Approx. keys used | Examples |
|---|---|---|
| `auth` | 30+ | `forgotPasswordHelp`, `backToSignIn`, `enterEmailToReset`, `forgotPasswordSent`, `passwordsDoNotMatch`, `fullNameRequired`, `registrationFailed` |
| `common` | 50+ | only `save`, `cancel`, `saving` exist today |
| `consultation` | 15+ | `consultationDetails`, `recordingType`, `startRecording`, `consentRequired` |
| `transcription` | 25+ | `loadingTranscription`, `duration`, `review`, `editTranscript` |
| `reports` | 15+ | `generatePDF`, `pdfOptions`, `failedToLoad` |
| `dashboard` | 8+ | `dashboardOverview`, `totalPatients`, `recentConsultations` |
| `subscription` | 15+ | `pleaseLoginToContinue`, `unexpectedErrorOccurred`, `paymentMethodDeclined` |
| `superAdmin` | 25+ | `chooseYourPlan`, `monthly`, `errorFetchingPlans` |
| `navigation` | 8+ | `dashboard`, `patients`, `newConsultation`, `reports`, `analytics`, `followUps`, `appointments`, `settings` |
| `settings` | 12+ | `profile`, `security`, `failedToLoadProfile` |
| `errors` | 5+ | `network`, `unauthorized`, `serverError` |
| `speech` | 2 | `start`, `stop` |
| `patients` | 20+ | only 8 keys exist today |

---

## Final Summary

- **Report path:** [UI_UX_AUDIT_REPORT.md](UI_UX_AUDIT_REPORT.md)
- **Issues found:** 47
- **Top 5 urgent UI issues:**
  1. **F-001** — Broken i18n pipeline; raw keys like `auth.backToSignIn` leak to UI and are the root cause of nearly every "weird text" symptom (including "3. RECORDING TYPE", "transcriptionreview", "P atient", "Do ctor").
  2. **F-050** — Tables overflow horizontally on mobile without a scroll container; Dashboard becomes unusable on phones.
  3. **F-052** — Mobile sidebar has no overlay / outside-click close; users get trapped.
  4. **F-011 / F-012** — Buttons and colors bypass the design tokens; visual inconsistency across Pricing / Appointments / FollowUps / BookAppointment.
  5. **F-062 / F-070** — Two duplicate Patient-edit pages (`EditPatient.tsx` and `PatientEdit.tsx`) silently drift apart.
- **Code files modified:** **No.**
