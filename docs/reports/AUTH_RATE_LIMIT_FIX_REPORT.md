# Auth Validate-Token Rate Limiter Fix Report

## Files changed
- `backend-node/src/app.js`

## Exact behavior before
- `authLimiter` was mounted on `/api/auth` with `max: 5` requests per 15 minutes and no skip rule.
- Result: all auth routes under `/api/auth` consumed the same strict budget, including `GET /api/auth/validate-token`.
- Side effect: repeated session validation checks could exhaust the same limiter used for brute-force protection on login/register and trigger `429`.

## Exact behavior after
- `authLimiter` remains mounted on `/api/auth` with unchanged brute-force settings (`windowMs: 15m`, `max: 5`).
- Added skip rule:
  - `skip: (req) => req.method === 'GET' && req.path === '/validate-token'`
- Result:
  - `GET /api/auth/validate-token` is exempt from the strict auth limiter.
  - `POST /api/auth/login` and `POST /api/auth/register` still consume and enforce the strict auth limiter.
  - Auth protection middleware behavior remains unchanged (no controller/middleware logic edits).

## Tests run
1. Syntax check:
   - `node --check backend-node/src/app.js`
2. Runtime verification with backend started (`npm run start` in `backend-node`):
   - Repeated `GET /api/auth/validate-token` 8 times.
   - Repeated `POST /api/auth/login` 8 times with bad credentials.

## Test results
- Syntax:
  - Pass (`node --check` exit code `0`).
- Runtime:
  - `GET /api/auth/validate-token`: status codes stayed `401` across repeated calls (no `429` from strict auth limiter).
  - `POST /api/auth/login`: status codes were `401` initially, then `429` after threshold (`401, 401, 401, 401, 401, 429, 429, 429`), confirming limiter enforcement remains active.

## Remaining risks
- The skip condition is path/method-specific (`GET` + `/validate-token`) and intentionally narrow. If route path or method changes in future, exemption must be updated accordingly.
- This change does not alter any global limiter behavior outside `/api/auth`.

## Suggested commit command
```bash
git add backend-node/src/app.js AUTH_RATE_LIMIT_FIX_REPORT.md && git commit -m "fix(auth): exempt validate-token from strict auth limiter"
```
