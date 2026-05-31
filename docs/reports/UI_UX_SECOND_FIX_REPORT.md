# UI/UX Second-Pass Fix Report

**Date:** 2026-05-31
**Inputs:** [UI_UX_FIX_REPORT.md](UI_UX_FIX_REPORT.md), [FRONTEND_UI_QA_REPORT.md](FRONTEND_UI_QA_REPORT.md)
**Scope:** Frontend only. No backend (`backend-node/`) or `ai-service/` files touched. No API contracts, auth backend behaviour, or libraries changed.

---

## Files changed

| File | Change |
| --- | --- |
| [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx#L132-L161) | `isTokenValid()` now only treats HTTP 401/403 as an invalid-token signal; 429, network failures and 5xx re-throw so the existing local session is preserved. |
| [frontend/src/locales/en/translation.json](frontend/src/locales/en/translation.json) | (a) Added `speech.languages` namespace with `en-US`/`ur-PK`. (b) Rewrote Pricing copy: `save17Percent` → "Save 17%", `monthBilledAnnually` → "/month, billed annually", `selectPerfectPlan` → real sub-title, all four FAQ Q/A pairs replaced with real product copy. (c) Added `navigation.analytics/followUps/appointments` plus matching `*Subtitle` keys for the top header. |
| [frontend/src/components/layout/Header.tsx](frontend/src/components/layout/Header.tsx#L23-L33) | Added route entries for `/analytics`, `/follow-ups`, `/appointments` so the topbar shows route-specific title + subtitle instead of falling back to "Clinix.ai / Audio to Medical Reports". |

No other files were modified.

---

## Issues fixed

1. **Auth 429 wipes session (NEW-1, High).** `isTokenValid` now distinguishes "token rejected" (401/403) from "could not verify" (429/network/5xx). The outer `checkAuth` already had a `catch` that keeps the locally-stored user — rethrowing now correctly routes transient failures into that path, so being rate-limited no longer signs the user out. Logout still happens on real 401/403. Backend was **not** touched.
2. **Raw `speech.languages.en-US` key on /new-consultation (NEW-2, Medium).** Added the missing 3-segment keys under a new `speech` top-level namespace. The dropdown now renders "English (US)" and "Urdu (Pakistan)".
3. **Pricing copy (NEW-3 / NEW-4, Medium).**
   - Billing toggle reads "Yearly **Save 17%**" (was "Yearly Save17percent").
   - Annual sub-line reads "$X.XX **/month, billed annually**" (was "Month billed annually").
   - Hero subtitle reads "Pick the plan that fits how your team records, reviews, and follows up with patients." (was "Select perfect plan").
   - All four FAQ questions and answers are real product copy: change plan, exceed limits, free trial, security. No Stripe / business-logic code changed.
4. **Topbar page header on /analytics, /follow-ups, /appointments (NEW-5, Low).** These three routes are now in the `Header.tsx` `routes[]` table, so the existing topbar component renders the page title and subtitle the same way it does for Dashboard / Patients / Reports etc. No new component, no layout refactor.

The "Transcriptions120/Month" / "Storage80GB" reading from §NEW-3 is a flex `justify-between` layout where the screen-reader text concatenates the two opposing spans. The on-screen rendering already shows the label and value on opposite ends of the row, so the markup was intentionally left alone (the rule was: do not refactor large pages).

---

## Build result

```
npm run build
✓ 2336 modules transformed.
✓ built in 8.21s
```

PASS. Bundle size warning is pre-existing (single 853 kB chunk).

## Lint result

```
npm run lint
✖ 196 problems (177 errors, 19 warnings)
```

Baseline before this pass: **178 errors / 19 warnings**. After this pass: **177 errors / 19 warnings**. No new errors or warnings introduced (one pre-existing error was incidentally removed by simplifying the `isTokenValid` `try/catch`). All remaining lint output is in files we did not touch (`services/*`, `super-admin/*`, `types/subscription.ts`, `utils/transcription.ts`).

---

## Remaining issues (pre-existing, not addressed in this pass)

| ID | Severity | Source | Notes |
| --- | --- | --- | --- |
| PRE-1 | Medium | QA §5.2 | `/analytics` "Top Diagnoses" bar chart paints a solid green rectangle when data is empty. Needs a true empty state. |
| PRE-2 | Medium | QA §5.2 | `/analytics` "Diagnosis Distribution" panel has no content and no empty state. |
| PRE-3 | Medium | QA §5.2 | `/past-consultations` "Type" column shows raw enums (`general`, `follow_up`) and the actions column clips on 1440 px. Requires enum-to-label map + column width review. |
| PRE-4 | Medium | QA §5.2 | `/follow-ups` page is a bare card list — no search, filter, status grouping, actions, or empty state. |
| PRE-5 | Medium | QA §5.2 | `/appointments` page same shape — bare cards, no filter / actions. |
| PRE-6 | Low | QA §5.2 | Windows Chromium does not render the 🇺🇸 regional-indicator emoji; trigger shows "us English". Cosmetic, font-stack issue. |
| PRE-7 | Low | QA §5.2 | Settings → Language tab still lists Urdu, but only English ships; selecting Urdu silently falls back. |
| PRE-8 | Low | QA §5.2 | Mobile sidebar has no backdrop / tap-outside-to-close. |
| Lint debt | Info | Lint output | 177 pre-existing `no-explicit-any` / unused-var errors in untouched files. Explicitly out of scope. |

---

## Pages to re-check manually

1. **/new-consultation** — open the speech-language dropdown; both options should now read "English (US)" and "Urdu (Pakistan)". No raw `speech.languages.*` text should appear.
2. **/pricing** — confirm: billing toggle shows "Yearly Save 17%"; the annual sub-line reads naturally; all four FAQ entries display real questions and answers; plan cards still align (no overflow on the rephrased annual line).
3. **/analytics**, **/follow-ups**, **/appointments** — the dark topbar should show the route's own title ("Analytics", "Follow-ups", "Appointments") and subtitle, not "Clinix.ai / Audio to Medical Reports".
4. **Auth resilience** — refresh a protected page (e.g. `/`) several times within 15 minutes to trigger `/api/auth/validate-token` rate-limit (HTTP 429). The user should stay signed in. Verify a real 401 (e.g. after manually corrupting the token) still bounces to `/login`.
5. **Mobile (375 px)** — re-screenshot `/pricing` and confirm the new annual sub-line wraps cleanly and no horizontal scrollbar appears.
6. **Sidebar links** — confirm the existing `superAdmin` / sidebar copy still resolves; `navigation.*` was extended, not renamed.
