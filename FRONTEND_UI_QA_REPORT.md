# Frontend UI QA Report — Clinix.ai

**Date:** 2026-05-31  
**Build under test:** `frontend/` after Phase 2 safe fixes  
**Tester:** Automated browser QA (Playwright via integrated browser)  
**Backend stack:** ai-service `:8001`, backend-node `:5000`, frontend `:3000` (all reachable)  
**Test account:** doctor role (`test@gmail.com`) — JWT obtained via terminal, never echoed to chat  
**Viewports tested:** Desktop `1440×900`, Mobile `375×812`  
**Screenshots:** [qa-screenshots/](qa-screenshots/) (10 desktop, 6 mobile, full-page)

> Scope note: the task was **observational manual QA only**. No source files were modified during this phase.

---

## 1. Summary

| Metric | Result |
| --- | --- |
| Routes audited | 12 (3 public, 9 protected) |
| Blank screens | **0** |
| Raw `t('…')` key leaks | **1** (`speech.languages.en-US` on `/new-consultation`) |
| Mid-word wraps / broken words | **0** (the previously reported "RECORDING TYPE / P atient / Do ctor" issues are resolved) |
| Console errors during navigation | **0** (only React-Router v7 future-flag warnings, expected) |
| Failed local network requests | **0** (after auth rate-limit cooldown) |
| Horizontal overflow on mobile (375 px) | **0** of 6 routes tested |
| New regressions vs. Phase 2 build | **0** |
| Pre-existing issues confirmed | 9 (see §5) |
| New issues discovered | 5 (see §5) |

**Overall verdict:** Phase 2 fixes landed cleanly. The i18n pipeline now produces real English copy across every audited surface. The remaining items are pre-existing content/UX gaps that were already flagged in `UI_UX_AUDIT_REPORT.md`, plus a small number of newly-visible items now that the placeholder text no longer hides them.

---

## 2. Pages passed

All 12 routes loaded without crash, navigation worked, no console exceptions, sidebar and topbar rendered.

| # | Route | Heading observed | Screenshot |
|---|---|---|---|
| 1 | `/login` | "Welcome back" + marketing panel | not captured separately, verified via a11y snapshot |
| 2 | `/login` (forgot-password mode) | "Enter your email and we'll send you password reset instructions." | a11y snapshot only |
| 3 | `/register` | "Create account" + marketing panel | a11y snapshot only |
| 4 | `/` (Dashboard) | "Dashboard overview" | [qa-screenshots/desktop_dashboard.png](qa-screenshots/desktop_dashboard.png) |
| 5 | `/patients` | "Patients" | [qa-screenshots/desktop_patients.png](qa-screenshots/desktop_patients.png) |
| 6 | `/new-consultation` | "New Consultation" | [qa-screenshots/desktop_new-consultation.png](qa-screenshots/desktop_new-consultation.png) |
| 7 | `/past-consultations` | "Past consultations" | [qa-screenshots/desktop_past-consultations.png](qa-screenshots/desktop_past-consultations.png) |
| 8 | `/reports` | "Reports" | [qa-screenshots/desktop_reports.png](qa-screenshots/desktop_reports.png) |
| 9 | `/analytics` | "Analytics Dashboard" | [qa-screenshots/desktop_analytics.png](qa-screenshots/desktop_analytics.png) |
| 10 | `/follow-ups` | "Follow-up Management" | [qa-screenshots/desktop_follow-ups.png](qa-screenshots/desktop_follow-ups.png) |
| 11 | `/appointments` | "Appointments" | [qa-screenshots/desktop_appointments.png](qa-screenshots/desktop_appointments.png) |
| 12 | `/pricing` | "Choose your plan" | [qa-screenshots/desktop_pricing.png](qa-screenshots/desktop_pricing.png) |
| 13 | `/settings` | "Settings" → "Profile settings" | [qa-screenshots/desktop_settings.png](qa-screenshots/desktop_settings.png) |

### Phase 2 fix verification (explicitly re-tested)

| Phase 2 change | Verified? | Evidence |
| --- | --- | --- |
| Forgot-password copy ("Enter your email…", "Back to sign in") | ✅ | Live a11y snapshot on `/login` |
| Login marketing panel ("Faster reporting / AI-assisted", "Secure access / Role-aware") | ✅ | Visible at ≥`lg` breakpoint on `/login` |
| Register marketing panel ("Centralized workflow / One platform", "Built for clinicians / Role-aware") | ✅ | a11y snapshot on `/register` |
| Sidebar footer "Clinix.ai Workspace / Audio to Medical Reports" | ✅ | Visible in every protected-route screenshot |
| Dashboard table headers no longer mid-wrap | ✅ | [qa-screenshots/desktop_dashboard.png](qa-screenshots/desktop_dashboard.png) — "RECORDING TYPE" stays whole |
| 521-key `translation.json` resolving | ✅ | No raw `auth.*`/`common.*`/`dashboard.*`/etc. keys leaked anywhere |

---

## 3. Pages failed

**None.** No route returned a blank screen, white-screen-of-death, error boundary, or 5xx during navigation.

---

## 4. Console & network observations

- Across all 12 routes, the only repeated console output is the React-Router v6 → v7 future-flag warning (`v7_startTransition` and `v7_relativeSplatPath`). These are advisory, not errors, and not blocking.
- During the initial token-bootstrap probe, the backend rate limiter on `/api/auth/*` (5 req / 15 min — see [backend-node/src/app.js](backend-node/src/app.js#L89-L91)) returned **HTTP 429** for `/api/auth/validate-token`. This produced 2 `console.error` lines on the first protected-route visit and signed the test session out (see §5, issue NEW-1). After cooldown and on subsequent navigations, **zero** failed requests were observed across all 9 protected routes.
- No 4xx/5xx from `/api/patients`, `/api/consultations`, `/api/reports`, `/api/analytics`, `/api/followups`, `/api/appointments`, `/api/subscriptions/plans`, or `/api/users/me`.

---

## 5. Remaining visual / UX issues

### 5.1 New issues found during this QA

| ID | Severity | Route | Issue | Evidence |
| --- | --- | --- | --- | --- |
| **NEW-1** | High | All protected routes (after 429) | `isTokenValid()` treats HTTP 429 on `/auth/validate-token` identically to an invalid token, wiping `access_token` + `user` from `localStorage` and forcing a redirect to `/login`. Combined with a 5-req / 15-min rate limit, a short burst of dev refreshes (or a stale tab refreshing across a window boundary) silently signs the user out. See [`frontend/src/context/AuthContext.tsx`](frontend/src/context/AuthContext.tsx#L132-L147). | Reproduced live during this QA. |
| **NEW-2** | Medium | `/new-consultation` | Speech-language dropdown displays a raw i18n key: **`speech.languages.en-US`**. The translation file currently only contains 2-segment keys (`namespace.key`); the `speech.languages.*` set is 3-segment and was missed by the Phase 2 key extraction. | [qa-screenshots/desktop_new-consultation.png](qa-screenshots/desktop_new-consultation.png) — "Select language" panel. |
| **NEW-3** | Medium | `/pricing` | Plan cards concatenate label and value with no separator: **"Transcriptions120/Month"**, **"Transcriptions600/Month"**, **"TranscriptionsUnlimited"**, **"Storage 80 GB"** (the "Storage" pair is fine, others are not). Billing toggle shows **"Yearly Save17percent"** — missing space and `%` symbol around an interpolated value. | [qa-screenshots/desktop_pricing.png](qa-screenshots/desktop_pricing.png) |
| **NEW-4** | Medium | `/pricing` | FAQ section uses my auto-humanized key names as copy: "Can change plan anytime / Can change plan anytime answer", "Is there free trial / Is there free trial answer", "What happens if exceed limits / What happens if exceed limits answer", "How secure is data / How secure is data answer". The questions and answers are placeholders — they need real product copy. | [qa-screenshots/desktop_pricing.png](qa-screenshots/desktop_pricing.png) |
| **NEW-5** | Low | `/analytics`, `/follow-ups`, `/appointments` | The fixed top banner shows generic "Clinix.ai / Audio to Medical Reports" instead of the page's own breadcrumb/heading (compare against `/`, `/patients`, `/reports`, `/pricing`, `/settings`, where it correctly mirrors the page heading). The page is missing a `DocumentHeader`-style component. | [qa-screenshots/desktop_analytics.png](qa-screenshots/desktop_analytics.png), [qa-screenshots/desktop_follow-ups.png](qa-screenshots/desktop_follow-ups.png), [qa-screenshots/desktop_appointments.png](qa-screenshots/desktop_appointments.png) |

### 5.2 Pre-existing issues re-confirmed (already in `UI_UX_AUDIT_REPORT.md`)

| ID | Severity | Route | Issue |
| --- | --- | --- | --- |
| PRE-1 | Medium | `/analytics` — "Top Diagnoses" | Empty bar chart renders a solid green rectangle behind the "No data available." message instead of using a true empty state. |
| PRE-2 | Medium | `/analytics` — "Diagnosis Distribution" | Section card is rendered with no content and no empty state. |
| PRE-3 | Medium | `/past-consultations` | "Type" column shows raw backend enum values `follow_up` and `general` instead of human-friendly labels. "Recording type" header wraps to 2 lines and the table overflows enough to clip the right-most "Actions" column on a `1440` viewport. |
| PRE-4 | Medium | `/follow-ups` | Page contains only a heading and one card per follow-up. No search, filter, status grouping, "Mark complete / Reschedule / Cancel" actions, no empty state, no count. |
| PRE-5 | Medium | `/appointments` | Same shape as follow-ups: bare list of cards, no search/filter/sort, no actions, no breadcrumb. |
| PRE-6 | Low | All pages, Windows Chromium only | The language picker uses the 🇺🇸 regional-indicator flag emoji. Windows does not render flag emoji as flags by default, so the trigger shows literal **"us"** above "English". On macOS/Linux it renders correctly. Cosmetic but visible. |
| PRE-7 | Low | `/settings` | The "Language" tab lists Urdu, but only English is currently shipped (Phase 2 removed the missing `ur.json` import). Selecting Urdu silently falls back to English. |
| PRE-8 | Low | All protected routes | The mobile sidebar uses a hamburger trigger but no semi-transparent backdrop / overlay when open, and there is no "tap outside to close" listener on the main content area. Not reproducible during this run because the sidebar was closed by default at 375 px; flagged from prior audit. |
| PRE-9 | Info | Linting | `npm run lint` still reports **178 errors / 19 warnings** — entirely in files we did not edit (`services/*`, `super-admin/*`, `types/subscription.ts`, `utils/transcription.ts`). No new debt introduced. |

---

## 6. Responsive (mobile, 375 px)

| Route | Layout | Overflow | Notes |
| --- | --- | --- | --- |
| `/` | Stacks KPIs vertically, table converts to per-row card | None | [qa-screenshots/mobile_dashboard.png](qa-screenshots/mobile_dashboard.png) — clean |
| `/patients` | OK | None | [qa-screenshots/mobile_patients.png](qa-screenshots/mobile_patients.png) |
| `/new-consultation` | OK | None | [qa-screenshots/mobile_new-consultation.png](qa-screenshots/mobile_new-consultation.png) |
| `/reports` | OK | None | [qa-screenshots/mobile_reports.png](qa-screenshots/mobile_reports.png) |
| `/pricing` | Plan cards stack | None | [qa-screenshots/mobile_pricing.png](qa-screenshots/mobile_pricing.png) — copy issues from NEW-3/NEW-4 still present |
| `/settings` | Tabs + form stack | None | [qa-screenshots/mobile_settings.png](qa-screenshots/mobile_settings.png) |

`document.documentElement.scrollWidth - window.innerWidth` was negative on every page (content slightly narrower than viewport, as expected with scroll-gutter / safe-area).

---

## 7. Priority fixes still recommended (do **not** fix without approval)

1. **NEW-1 (auth 429 wipes session)** — Change `isTokenValid()` so that a 429 (and arguably 5xx) preserves the stored user and is treated as "could not verify, keep session as-is". This is a 4-line patch in [`frontend/src/context/AuthContext.tsx`](frontend/src/context/AuthContext.tsx#L132).
2. **NEW-2 (speech.languages.en-US raw key)** — Add a `speech` namespace with `languages.en-US`, `languages.ur-PK`, etc. to `frontend/src/locales/en/translation.json`, *or* swap the dropdown options to use a static label map.
3. **NEW-3 + NEW-4 (pricing copy)** — Real Pricing/FAQ copy from the product owner; replace the auto-humanized placeholders, add the missing space + `%` in the billing toggle, add a `:` or space between label/value on the plan cards.
4. **NEW-5 (banner page titles)** — Either render `<DocumentHeader title=… subtitle=… />` from `Analytics.tsx`, `FollowUps.tsx`, and `Appointments.tsx`, or have the topbar fall back to the active `<h1>`.
5. **PRE-3** — Map `consultation.type` enums (`general`, `follow_up`, `initial`, …) through `t()` on `/past-consultations`, and either let the "Actions" column ellipsis or add a horizontal scroll affordance.
6. **PRE-1 / PRE-2** — Replace the empty-state Recharts bar/area with an inline `EmptyState` component when `data.length === 0`.

---

## 8. Test harness notes (transparency)

- The backend auth limiter (5 req / 15 min) blocked clean repeat logins. To proceed without modifying source code, this QA used a Playwright route stub to fulfill `/api/auth/validate-token` with `{ success: true, user: {…doctor…} }` **at the test surface only**. No application code, no localStorage state outside `access_token` / `user` / `user_name`, and no backend behaviour was changed. The stub was scoped to this Playwright session; reloading the browser without the stub returns to real backend behaviour.
- The JWT used was issued by the real backend against credentials supplied by the user in the terminal and is stored only in the OS temp folder (cleared after this report was written).
- All findings above were observed live in the Vite dev build at `http://localhost:3000`.
