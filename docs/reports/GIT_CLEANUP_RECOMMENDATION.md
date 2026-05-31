# Git Cleanup Recommendation — Session 1

**Project:** Clinix.ai
**Root:** `D:\clinixai-stage`
**Date:** 2026-05-31
**Mode:** **Inspection only.** No files were staged, committed, deleted, or edited. No `git add`, no push, no rebase, no force-push. Code was **not** modified.
**Source of truth:** [PROJECT_RESCUE_AND_REFACTOR_PLAN.md](PROJECT_RESCUE_AND_REFACTOR_PLAN.md) §2 + §11 Session 1.

---

## 1. Current state

- **Current branch:** `my-working-code`
- **HEAD:** `b355d05 fix: improve frontend i18n and UI polish`
- **Total changed entries:** 13 — **8 modified (tracked)** + **5 untracked** (4 `.md` files + 1 `qa-screenshots/` directory containing 16 PNGs).
- **Conflict markers:** none.
- **Code modified by this session:** **No.**

`git diff --stat` summary: 8 files changed, 124 insertions(+), 25 deletions(-).

---

## 2. Grouped changes

### Group A — Backend security fixes (tracked, modified)
| File | What changed |
|---|---|
| `backend-node/src/controllers/reminderController.js` | Hardens `/api/reminders/run`: now returns **401 Unauthorized** unless `REMINDER_RUN_SECRET` is both configured AND matched (previously 403 only when a secret existed — an unset secret left the door open). Prevents anonymous WhatsApp send-outs. |
| `backend-node/src/routes/testRoutes.js` | `GET /openai` and `POST /openai-soap` now require `protect` + `authorize('super_admin')`. Previously public; these make real OpenAI calls. |
| `backend-node/src/routes/aiRoutes.js` | `POST /drug-safety` now requires `protect`. Previously public; reaches external AI providers. |
| `backend-node/src/controllers/twilioWebhookController.js` | Adds a **SECURITY TODO comment block** documenting that Twilio signature verification is not yet implemented and how to add it. **No runtime behavior change** — the webhook still accepts unsigned requests. |
| `backend-node/src/controllers/consultationController.js` | Defensive fixes in appointment-from-report flow: derive `doctorId` safely, skip appointment creation when patient phone is missing, and wrap `createOrUpdateAppointmentForReport` in try/catch so a failed appointment sync no longer blocks saving the report. |

- **Commit?** **Yes** — highest priority. Closes C-2 (reminder/test endpoints) and tightens C-6 (drug-safety). The `consultationController.js` change is a related backend robustness fix.
- **Recommended commit message:**
  ```
  fix(security): protect reminder/test/ai endpoints and harden report-to-appointment sync
  ```
- **Exact git add command:**
  ```
  git add backend-node/src/controllers/reminderController.js backend-node/src/routes/testRoutes.js backend-node/src/routes/aiRoutes.js backend-node/src/controllers/twilioWebhookController.js backend-node/src/controllers/consultationController.js
  ```
- **Ignore/delete?** None.

> Note vs plan: The plan (§2.1 bucket B / C-3) expected the Twilio file to contain an *implemented* `validateRequest` signature check. The actual working-tree edit only adds a TODO comment — the webhook is **still unsigned/insecure at runtime**. Flagging so this is not mistaken for a completed fix. (See §4 "files needing review".)

> Optional split: if you prefer to keep the unrelated `consultationController.js` robustness change out of the security commit, commit the 4 route/controller security files first, then `consultationController.js` separately as `fix(consultation): make report-to-appointment sync non-blocking`.

### Group B — Frontend UI fixes (tracked, modified)
| File | What changed |
|---|---|
| `frontend/src/context/AuthContext.tsx` | `isTokenValid` now only signs the user out on 401/403. 429 (rate limit), network errors, and 5xx are re-thrown so the session is preserved. Closes C-5. |
| `frontend/src/components/layout/Header.tsx` | Adds 3 route-header entries: `/analytics`, `/follow-ups`, `/appointments`. |

- **Commit?** **Yes** — small, well-scoped, cosmetic + UX.
- **Recommended commit message:**
  ```
  fix(frontend): preserve session on 429/network errors; add page headers for analytics/follow-ups/appointments
  ```
- **Exact git add command:**
  ```
  git add frontend/src/context/AuthContext.tsx frontend/src/components/layout/Header.tsx
  ```
- **Ignore/delete?** None.

### Group C — Tooling / start scripts (tracked, modified)
| File | What changed |
|---|---|
| `start-local.ps1` | (1) Renames the loop variable `$pid` → `$processId`/`$fallbackProcessId` (`$pid` is a reserved PowerShell automatic variable — correct fix). (2) Adds `Resolve-FFmpegBinPath` to auto-detect FFmpeg/ffprobe and inject it into the AI service job's PATH. Tooling only; **no secrets, no app code.** |

- **Commit?** **Yes** — safe `chore`. Reviewed: only adds port/PID handling + FFmpeg PATH detection.
- **Recommended commit message:**
  ```
  chore(tooling): auto-detect FFmpeg and fix PID variable handling in start-local.ps1
  ```
- **Exact git add command:**
  ```
  git add start-local.ps1
  ```
- **Ignore/delete?** None.

### Group D — Documentation / reports (untracked)
| File |
|---|
| `FRONTEND_UI_QA_REPORT.md` |
| `UI_UX_AUDIT_REPORT.md` |
| `UI_UX_FIX_REPORT.md` |
| `UI_UX_SECOND_FIX_REPORT.md` |
| `PROJECT_RESCUE_AND_REFACTOR_PLAN.md` |
| `GIT_CLEANUP_RECOMMENDATION.md` (this file) |

- **Commit?** **Yes** — as a separate `docs:` commit.
- **Recommended commit message:**
  ```
  docs: add UI/UX audit, QA/fix reports, rescue plan and git cleanup recommendation
  ```
- **Exact git add command:**
  ```
  git add FRONTEND_UI_QA_REPORT.md UI_UX_AUDIT_REPORT.md UI_UX_FIX_REPORT.md UI_UX_SECOND_FIX_REPORT.md PROJECT_RESCUE_AND_REFACTOR_PLAN.md GIT_CLEANUP_RECOMMENDATION.md
  ```
- **Ignore/delete?** None. (No secrets present in these docs; they reference env var *names* only.)

### Group E — Screenshots / QA evidence (untracked)
| Path | Contents |
|---|---|
| `qa-screenshots/` | 16 PNGs (~3.7 MB total), desktop + mobile screens. Per plan §2.1 these are **synthetic** data, so safe. |

- **Commit?** **Optional / your call.** Safe to commit since data is synthetic, but ~3.7 MB of binaries will live in history forever. Two valid choices:
  - **Keep in repo:** commit as `docs(qa): add desktop/mobile QA screenshots`.
  - **Keep local only:** add `qa-screenshots/` to `.gitignore` and do not commit.
- **Exact git add command (only if you choose to commit):**
  ```
  git add qa-screenshots/
  ```
- **Ignore/delete?** If you'd rather not bloat history, add `qa-screenshots/` to `.gitignore`. Do **not** delete the local files.

### Group F — Risky / unrelated / already-tracked tech debt
These are **not** in the current working-tree changes (nothing to stage), but were surfaced during inspection and the plan flags them. **No action this session.**
| Item | Status | Recommendation (future, not now) |
|---|---|---|
| `temp_diff.txt` | Already committed in `60982e7` | Scratch file that should not be in history. Future session: `git rm --cached temp_diff.txt` + add to `.gitignore`. Out of scope here (no deletes). |
| `ai-service/temp_transcribe_test.wav` | Already committed in `60982e7` | Test artifact in history. Future: `git rm --cached` + ignore. Out of scope here. |
| `.env` files | **Not tracked** (only `*.env.example` are tracked) | Confirmed safe — no real secrets in git. `.gitignore` already excludes `.env`. |

---

## 3. `.gitignore` review

Current `.gitignore` already covers `.env`, `node_modules/`, `.venv/`, `uploads/`, `__pycache__/`, `.DS_Store`. **No real `.env` file is tracked** — only `.env.example` templates (safe). No secrets are exposed by any staged-candidate file.

Optional additions (not required for Session 1):
- `qa-screenshots/` (only if you choose Group E "keep local").
- `temp_diff.txt` and `ai-service/temp_transcribe_test.wav` (paired with a future `git rm --cached`).

---

## 4. Files safe to commit vs. needing review

**Safe to commit as-is:**
- `frontend/src/context/AuthContext.tsx`, `frontend/src/components/layout/Header.tsx` (Group B)
- `start-local.ps1` (Group C)
- All Group D docs
- `reminderController.js`, `testRoutes.js`, `aiRoutes.js` (Group A — real, verified hardening)

**Needing your review before/at commit:**
- `backend-node/src/controllers/twilioWebhookController.js` — **only adds a TODO comment; the webhook is still unsigned.** C-3 is documented, **not fixed**. Decide whether to commit the comment now (recommended, it records the gap) and track the real `validateRequest` fix as a follow-up (plan S-2 / Session 2).
- `backend-node/src/controllers/consultationController.js` — unrelated to endpoint security; it's a report-to-appointment robustness fix. Optionally commit separately (see Group A optional split).

**Files to ignore/delete:** none in the live working tree. `temp_diff.txt` and `temp_transcribe_test.wav` are already-committed tech debt to clean up in a future session (not this one).

---

## 5. Recommended commit order (no rebase, no force-push)

1. **Security** — Group A
2. **Frontend** — Group B
3. **Tooling** — Group C
4. **Docs** — Group D
5. **(Optional) Screenshots** — Group E

> The plan asks for 3 commits (A, B, D). This recommendation adds tooling (C) and optional screenshots (E) as their own commits to keep concerns separate. Combine C into the docs/chore commit if you prefer fewer commits. Never combine A + B.

---

## 6. Exact commands to run manually (after your approval)

```powershell
# 0. Sanity check — confirm branch and state
git status -sb

# 1. Security commit (Group A)
git add backend-node/src/controllers/reminderController.js backend-node/src/routes/testRoutes.js backend-node/src/routes/aiRoutes.js backend-node/src/controllers/twilioWebhookController.js backend-node/src/controllers/consultationController.js
git commit -m "fix(security): protect reminder/test/ai endpoints and harden report-to-appointment sync"

# 2. Frontend commit (Group B)
git add frontend/src/context/AuthContext.tsx frontend/src/components/layout/Header.tsx
git commit -m "fix(frontend): preserve session on 429/network errors; add page headers for analytics/follow-ups/appointments"

# 3. Tooling commit (Group C)
git add start-local.ps1
git commit -m "chore(tooling): auto-detect FFmpeg and fix PID variable handling in start-local.ps1"

# 4. Docs commit (Group D)
git add FRONTEND_UI_QA_REPORT.md UI_UX_AUDIT_REPORT.md UI_UX_FIX_REPORT.md UI_UX_SECOND_FIX_REPORT.md PROJECT_RESCUE_AND_REFACTOR_PLAN.md GIT_CLEANUP_RECOMMENDATION.md
git commit -m "docs: add UI/UX audit, QA/fix reports, rescue plan and git cleanup recommendation"

# 5. (OPTIONAL) Screenshots commit (Group E) — only if you want them in history
git add qa-screenshots/
git commit -m "docs(qa): add desktop/mobile QA screenshots"

# Verify
git log --oneline -n 6
git status -sb
```

> **Do not** run `git add .`, `git push`, `git rebase`, or any force operation. `my-working-code` is already published — keep history append-only.

---

## 7. Answers to the required summary

- **Current branch:** `my-working-code` (HEAD `b355d05`)
- **Total changed files:** 13 entries — 8 modified + 4 untracked docs + 1 untracked screenshots dir (16 PNGs).
- **Files safe to commit:** the 8 modified files (Groups A/B/C) + the Group D docs.
- **Files needing review:** `twilioWebhookController.js` (comment-only, webhook still unsigned) and `consultationController.js` (unrelated robustness change — optional separate commit).
- **Files to ignore/delete:** none in the live tree. `temp_diff.txt` + `ai-service/temp_transcribe_test.wav` are already-committed tech debt for a future `git rm --cached` cleanup. `qa-screenshots/` optionally `.gitignore`'d.
- **Recommended commit order:** Security → Frontend → Tooling → Docs → (optional) Screenshots.
- **Was any code modified by this session:** **No.**
