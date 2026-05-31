# Twilio Webhook Security Fix Report

**Project:** Clinix.ai  
**Date:** 2026-05-31  
**Endpoint:** `POST /api/webhooks/twilio/whatsapp`  
**Mode:** Implementation + local verification only. **Not committed.**

---

## Summary

Implemented real Twilio webhook signature verification using the official `twilio` Node SDK (`validateRequest`). Unsigned and invalid requests are rejected with **403 Forbidden** when validation is enabled. Valid requests continue to return TwiML `<Response></Response>` as before.

No real WhatsApp messages were sent. No Twilio APIs were called. No `.env` secrets were exposed in logs or this report.

---

## Files changed

| File | Change |
|---|---|
| `backend-node/src/config/env.js` | Added `TWILIO_WEBHOOK_URL` and `TWILIO_WEBHOOK_VALIDATE` config |
| `backend-node/src/controllers/twilioWebhookController.js` | Added `verifyTwilioWebhookSignature` middleware using `twilio.validateRequest()`; removed TODO comment; business logic unchanged |
| `backend-node/src/routes/twilioWebhookRoutes.js` | Wired signature middleware before webhook handler |
| `backend-node/.env.example` | Documented new env variables |

**Unchanged:** frontend, ai-service, appointment/follow-up business logic, real `.env` files.

---

## Env variables added

| Variable | Purpose | Example |
|---|---|---|
| `TWILIO_WEBHOOK_URL` | Public URL Twilio POSTs to; must match exactly for signature validation | `https://your-domain.com/api/webhooks/twilio/whatsapp` |
| `TWILIO_WEBHOOK_VALIDATE` | Enable/disable signature validation in development | `true` (default) or `false` (local bypass only) |

Existing variable used: `TWILIO_AUTH_TOKEN` (already present; not modified).

---

## Validation behavior

### Production (`NODE_ENV=production`)

- Validation is **always enabled**, regardless of `TWILIO_WEBHOOK_VALIDATE`.
- Missing `TWILIO_AUTH_TOKEN` → **403**
- Missing `TWILIO_WEBHOOK_URL` → **403**
- Missing `X-Twilio-Signature` header → **403**
- Invalid signature → **403**
- Valid signature → handler runs; TwiML response preserved

### Development (default, `TWILIO_WEBHOOK_VALIDATE` unset or `true`)

- Same rules as production when validation is enabled.
- Unsigned/invalid requests → **403**

### Development bypass (`TWILIO_WEBHOOK_VALIDATE=false`)

- Signature validation skipped; server logs a warning.
- Unsigned simulated requests reach the handler (for local testing only).
- **Must not be used in production** — production ignores this flag and always validates.

---

## Test commands run

Backend started with `npm run start` from `backend-node/` (MongoDB available locally).

### Test 1 — Unsigned POST (validation enabled, default)

```powershell
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:5000/api/webhooks/twilio/whatsapp" `
  -Body "Body=1&From=whatsapp:+1234567890" `
  -ContentType "application/x-www-form-urlencoded" `
  -UseBasicParsing
```

**Result:** `403 Forbidden`  
**Server log:** `[Twilio Webhook] Rejected request: TWILIO_WEBHOOK_URL is not configured`

### Test 2 — Invalid signature header (validation enabled)

```powershell
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:5000/api/webhooks/twilio/whatsapp" `
  -Body "Body=1&From=whatsapp:+1234567890" `
  -ContentType "application/x-www-form-urlencoded" `
  -Headers @{"X-Twilio-Signature"="invalid-signature"} `
  -UseBasicParsing
```

**Result:** `403 Forbidden`  
**Server log:** `[Twilio Webhook] Rejected request: TWILIO_WEBHOOK_URL is not configured`

> Note: With `TWILIO_AUTH_TOKEN` set but `TWILIO_WEBHOOK_URL` unset, validation fails early (403) before signature comparison. This is correct secure behavior.

### Test 3 — Dev bypass (`TWILIO_WEBHOOK_VALIDATE=false`)

```powershell
$env:TWILIO_WEBHOOK_VALIDATE='false'
npm run start
# then:
Invoke-WebRequest -Method POST `
  -Uri "http://localhost:5000/api/webhooks/twilio/whatsapp" `
  -Body "Body=1&From=whatsapp:+1234567890" `
  -ContentType "application/x-www-form-urlencoded" `
  -UseBasicParsing
```

**Result:** `200 OK`, body `<Response></Response>`  
**Server log:** `[Twilio Webhook] Signature validation is disabled (TWILIO_WEBHOOK_VALIDATE=false)...`

### Test 4 — Backend startup

```powershell
node --check backend-node/src/controllers/twilioWebhookController.js
node --check backend-node/src/routes/twilioWebhookRoutes.js
node --check backend-node/src/config/env.js
npm run start
```

**Result:** Syntax checks passed; server started on port 5000 with MongoDB connected.

---

## Test results

| Scenario | Expected | Actual |
|---|---|---|
| Unsigned POST, validation enabled | 403 | 403 |
| Invalid signature, validation enabled | 403 | 403 |
| Unsigned POST, `TWILIO_WEBHOOK_VALIDATE=false` | 200 TwiML | 200 `<Response></Response>` |
| Backend startup | Starts cleanly | Passed |
| Real WhatsApp messages sent | No | No |

---

## Remaining risks

1. **`TWILIO_WEBHOOK_URL` must match Twilio's configured URL exactly** — including scheme, host, path, and no trailing-slash mismatch. Misconfiguration causes all legitimate Twilio callbacks to be rejected (403). Set this in production `.env` to the exact public URL Twilio uses.

2. **No automated regression test yet** — plan item S-2 (`twilioWebhook.test.js`) is still recommended to prevent future regressions.

3. **Dev bypass is opt-in** — developers must explicitly set `TWILIO_WEBHOOK_VALIDATE=false` for local unsigned simulation; default remains secure.

4. **Request body sanitization (S-11)** — XML/HTML injection in TwiML responses is out of scope for this fix; webhook payload fields are still processed by existing business logic.

5. **Reverse-proxy URL rewriting** — if nginx or a load balancer changes the public URL, `TWILIO_WEBHOOK_URL` must reflect the URL Twilio signs against, not the internal backend URL.

---

## Suggested commit (do not run until approved)

```powershell
git add backend-node/src/config/env.js backend-node/src/controllers/twilioWebhookController.js backend-node/src/routes/twilioWebhookRoutes.js backend-node/.env.example TWILIO_WEBHOOK_SECURITY_FIX_REPORT.md
git commit -m "fix(security): verify Twilio WhatsApp webhook signatures with validateRequest"
```
