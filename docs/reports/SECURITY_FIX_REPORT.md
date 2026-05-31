# Security Fix Report

Date: 2026-05-31
Branch: `my-working-code`
Scope: backend-node only. Frontend, Stripe, and Twilio sending paths were not modified.

## 1. Summary

Four targeted security fixes were applied based on findings in [LOCAL_STACK_VERIFICATION_REPORT.md](LOCAL_STACK_VERIFICATION_REPORT.md). Three fixes are functional (now return `401` instead of `200`); one is a documentation-only TODO note as requested. All changes are minimal, do not refactor unrelated code, and were verified with the exact endpoint tests recorded in Section 3 (before/after).

| # | Issue | Severity (before) | Fix type | Verified |
|---|---|---|---|---|
| 1 | `/api/reminders/run` open when `REMINDER_RUN_SECRET` unset | Critical | Hard-require secret; return 401 on missing/mismatch | Yes |
| 2 | `/api/test/openai`, `/api/test/openai-soap` public | Critical | `protect` + `authorize('super_admin')` | Yes |
| 3 | `/api/ai/drug-safety` public | High | `protect` middleware | Yes |
| 4 | Twilio webhook lacks signature verification | High | TODO comment only (per your instruction) | N/A |

## 2. Files Changed

| File | Change |
|---|---|
| [backend-node/src/controllers/reminderController.js](backend-node/src/controllers/reminderController.js) | Require `REMINDER_RUN_SECRET` to be set AND match supplied `x-reminder-secret`/`?secret=`. Return `401 {success:false,error:"Unauthorized"}` otherwise. |
| [backend-node/src/routes/testRoutes.js](backend-node/src/routes/testRoutes.js) | Import `protect, authorize` from auth middleware. Apply `protect, authorize('super_admin')` to `GET /openai` and `POST /openai-soap`. |
| [backend-node/src/routes/aiRoutes.js](backend-node/src/routes/aiRoutes.js) | Import `protect`. Apply `protect` to `POST /drug-safety`. |
| [backend-node/src/controllers/twilioWebhookController.js](backend-node/src/controllers/twilioWebhookController.js) | Added a header comment block flagging the missing Twilio signature verification and the exact remediation steps. **No functional change.** |

Files **not** touched: anything in `frontend/`, any Stripe controller/route, `twilioService.js` (no real messages), models, AI service, env files.

## 3. Before / After Tests

All tests run from the same local stack (`backend-node` on `http://localhost:5000`, MongoDB connected, AI service on `:8001`).

### Fix #1 — `POST /api/reminders/run`

| Scenario | Before | After |
|---|---|---|
| No secret header | `200 {"success":true,"data":{"checked":0,"sent":0,"skipped":0,"errors":0}}` | `401` |
| Wrong secret header | (would have been 200 since env var was empty) | `401` |

Notes:
- Server-side env `REMINDER_RUN_SECRET` is still unset in `backend-node/.env`. Endpoint is therefore closed by default. To re-enable, set `REMINDER_RUN_SECRET=<long random>` and pass it via `x-reminder-secret` (or `?secret=`).
- Status code changed from `403` (only on mismatch when secret was set) to `401` for any unauthorized invocation, per your spec.

### Fix #2 — `GET /api/test/openai` and `POST /api/test/openai-soap`

| Scenario | Before | After |
|---|---|---|
| `GET /api/test/openai` no auth | `200 {"success":true,"output":"Okay!"}` (real OpenAI call) | `401 Unauthorized` |
| `POST /api/test/openai-soap` no auth | `200 {"success":true,"soapNote":"Subjective: ..."}` (real OpenAI call) | `401 Unauthorized` |
| Invalid bearer token | n/a | `401 Unauthorized` |

### Fix #3 — `POST /api/ai/drug-safety`

| Scenario | Before | After |
|---|---|---|
| No auth | `200 {"warnings":[],"interactions":[],"recommendations":[]}` | `401 Unauthorized` |
| Invalid bearer token | n/a | `401 Unauthorized` |

### Fix #4 — Twilio webhook (documentation only)

| Scenario | Before | After |
|---|---|---|
| `POST /api/webhooks/twilio/whatsapp` unsigned | `200 <Response></Response>` | `200 <Response></Response>` (unchanged) |

The webhook is intentionally not yet hardened. The added comment documents the exact `validateRequest` remediation steps to apply once the public webhook URL is known.

### Regression sweep (post-changes)

| Endpoint | Result |
|---|---|
| `GET /health` | `200` (DB connected) |
| `GET /api/subscription/plans` | `200` (public, unchanged) |
| `GET /api/patients` no auth | `401` (already protected, still works) |
| `GET /api/appointments` no auth | `401` (already protected, still works) |

No regressions detected.

## 4. Remaining Risks

1. **Twilio webhook still unsigned** — the public endpoint will accept forged confirm/decline replies. Highest remaining risk after these fixes. Implement `validateRequest` once the production webhook URL is decided (see TODO in `twilioWebhookController.js`).
2. **`REMINDER_RUN_SECRET` not yet present in `backend-node/.env`** — endpoint is correctly closed today, but the operator (you) must set the secret and configure any external scheduler with the matching header before relying on automated reminders.
3. **Plaintext password fallback in `authController.loginUser`** — still present; not in scope for this round.
4. **Permissive CORS in `ai-service/app/main.py`** (`allow_origins=["*"]`) — still present; not in scope.
5. **Socket.IO not authenticated at connect time** — still present; not in scope.
6. **Subscription plans not seeded; `stripePriceId` blank** — out of scope (Stripe excluded by your rules).
7. **`/api/test/*` routes now require super-admin** — confirm with your team that no internal monitoring script was silently depending on these public routes; if so, give it a super-admin token or move it to `/health`.
8. **AI service `/health` exposes detailed env info** — unchanged; consider trimming before any external exposure.

## 5. Operator Follow-Up Checklist

1. Add `REMINDER_RUN_SECRET=<long random>` to `backend-node/.env`, restart backend, and re-invoke `/api/reminders/run` with the `x-reminder-secret` header to confirm `200`.
2. Provide a super-admin JWT (via the existing super-admin account) when calling `/api/test/openai*` from any internal tool that still needs it.
3. When the production Twilio webhook URL is decided, implement signature verification per the TODO in `twilioWebhookController.js` and remove the TODO comment.
4. Optionally rate-limit `/api/ai/drug-safety` per user to bound OpenAI spend even by authenticated callers.

## 6. Verification Notes

- All endpoint tests above were executed against the live local stack via `Invoke-WebRequest` immediately after each edit, with nodemon auto-reload on backend-node.
- No database records were created or modified.
- No real Twilio messages were sent. No Stripe sessions were created.
- No secrets were printed; environment values were only referenced by variable name.
