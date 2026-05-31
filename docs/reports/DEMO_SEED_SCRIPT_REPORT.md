# Demo Seed Script Report — Clinix.ai (Session 5)

**Project:** Clinix.ai  
**Root:** `D:\clinixai-stage`  
**Date:** 2026-05-31  
**Session:** `NEXT_IMPLEMENTATION_SESSIONS.md` → Session 5  
**Scope:** New offline demo seed script only. No frontend/ai-service/controller/route/model changes. **Not committed.**

---

## Files changed

| File | Change |
|---|---|
| `backend-node/scripts/seed-demo.js` | **New** — FYP demo seeder |
| `backend-node/package.json` | Added `"seed:demo": "node scripts/seed-demo.js"` |
| `DEMO_SEED_SCRIPT_REPORT.md` | **New** — this report |

**Not modified:** `frontend/**`, `ai-service/**`, `backend-node/src/**` (controllers, routes, models), real `.env` files.

---

## Models inspected and fields used

### `User.js`
| Field | Demo value |
|---|---|
| `email` | `demo@clinix.ai` (unique upsert key) |
| `passwordHash` | `bcrypt.hash(password, 10)` — password from `DEMO_DOCTOR_PASSWORD` or `--password` |
| `fullName` | `Dr. Demo Clinician` |
| `role` | `doctor` |
| `isActive` | `true` |
| `language` | `en` |

### `Patient.js`
| Field | Patient 1 (M Ali) | Patient 2 (Ahmed Raza) |
|---|---|---|
| `firstName` / `lastName` | M / Ali | Ahmed / Raza |
| `gender` | male | male |
| `dateOfBirth` | 2002-02-02 | 1990-01-01 |
| `email` | m.ali.demo@example.com | ahmed.raza.demo@example.com |
| `phone` | +92-300-0000001 | +92-300-0000002 |
| `address` | Demo Street, Lahore, PK | Demo Avenue, Karachi, PK |
| `medicalConditions` | ['Type 2 diabetes'] | [] |
| `currentMedications` | ['Metformin'] | [] |
| `doctorId` | demo doctor `_id` | demo doctor `_id` |
| `status` | active | active |
| `notes` | `[FYP demo seed data — safe for local presentations]` | same |
| `lastVisit` | now (patient 1 only) | — |

**Upsert key:** `{ doctorId, firstName, lastName }`

### `Consultation.js`
| Field | Demo value |
|---|---|
| `patientId` | Patient 1 (M Ali) |
| `doctorId` | demo doctor |
| `consultationType` | `general` |
| `recordingType` | `doctor_patient` (Doctor & Patient) |
| `status` | `transcribed` |
| `consentObtained` | `true` |
| `notes` / `consultationSummary` | canned demo transcript |
| `metadata.demoSeedKey` | `fyp-demo-consultation` (idempotency key) |
| `medicalInfo` | structured chief complaint / history / assessment |
| `soapApprovalStatus` | `approved` |
| `drugCheckStatus` | `completed` |

No `audioFilePath`, no `AiTask`, no `Transcription` document (not required by session spec; transcript lives on consultation fields).

### `Report.js`
| Field | Demo value |
|---|---|
| `consultationId` | demo consultation |
| `patientId` | Patient 1 |
| `doctorId` | demo doctor |
| `content` | full SOAP text (Subjective/Objective/Assessment/Plan) |
| `format` | `SOAP` |
| `status` | `generated` |
| `generatedBy` | `fyp-demo-seed` |
| `options.demoSeedKey` | `fyp-demo-report` (idempotency key) |

### Password hashing reference
`authController.js` uses `bcrypt.hash(password, 10)` — matched in seed script.

---

## Seed data created/updated (local `clinix_ai`)

| Entity | Result |
|---|---|
| Demo doctor | `demo@clinix.ai` — Dr. Demo Clinician |
| Patients | 2 — M Ali, Ahmed Raza |
| Consultation | `6a1c2bb2ffc71bdcc81a0581` — status `transcribed` |
| Report | `6a1c2bb2ffc71bdcc81a0582` — format `SOAP`, status `generated` |

---

## Idempotency

**Yes — verified.** Running `npm run seed:demo` twice produced:

- Same consultation ID: `6a1c2bb2ffc71bdcc81a0581`
- Same report ID: `6a1c2bb2ffc71bdcc81a0582`
- Mongo counts after two runs: **1** demo consultation, **1** demo report, **2** patients (no duplicates)

Upsert keys:
- Doctor → `email`
- Patients → `doctorId + firstName + lastName`
- Consultation → `metadata.demoSeedKey`
- Report → `options.demoSeedKey`

---

## Commands run

```powershell
node --check backend-node/scripts/seed-demo.js          # PASS
node --check backend-node/src/app.js                    # PASS
node --check backend-node/src/server.js                 # PASS

cd backend-node
$env:DEMO_DOCTOR_PASSWORD="DemoPassword123!"
npm run seed:demo                                       # PASS (first run)
npm run seed:demo                                       # PASS (second run — idempotent)
```

Mongo verification query confirmed doctor, 2 patients, 1 consultation, 1 report.

---

## Test results

| Check | Result |
|---|---|
| `node --check scripts/seed-demo.js` | PASS |
| `npm run seed:demo` (local DB) | PASS |
| Idempotent re-run | PASS (same IDs, no duplicate counts) |
| Backend syntax (`app.js`, `server.js`) | PASS |
| Password printed to console | **No** |
| External APIs called | **No** |

---

## External API usage

**None.** The script:

- Does **not** import `openai`, `twilio`, `stripe`, or AI service clients
- Does **not** create `AiTask` records
- Does **not** upload audio or call `/transcribe`
- Uses only `mongoose`, `dotenv`, `bcryptjs`, and local model imports

---

## Manual demo login steps

1. Ensure MongoDB is running locally.
2. Seed (once per environment):
   ```powershell
   cd D:\clinixai-stage\backend-node
   $env:DEMO_DOCTOR_PASSWORD="YourDemoPasswordHere"
   npm run seed:demo
   ```
3. Start the stack (`.\start-local.ps1` or manual backend + frontend).
4. Open `http://localhost:3000/login`
5. Sign in with:
   - **Email:** `demo@clinix.ai`
   - **Password:** the value you set in `DEMO_DOCTOR_PASSWORD` (not printed by the script)
6. Verify in UI:
   - `/patients` → M Ali and Ahmed Raza
   - `/past-consultations` → transcribed consultation for M Ali
   - `/reports` → saved SOAP report

> **Note:** Transcript modal on past consultations may require a `Transcription` document (not seeded in this session). The consultation summary/transcript is stored on the consultation record; the saved SOAP report is fully available under Reports.

---

## Suggested commit command (do NOT run until approved)

```powershell
git add backend-node/scripts/seed-demo.js backend-node/package.json DEMO_SEED_SCRIPT_REPORT.md

git commit -m "$(cat <<'EOF'
feat(backend): add offline FYP demo seed script

Adds seed:demo to upsert a demo doctor, two patients, one transcribed
consultation, and one SOAP report without OpenAI, Twilio, Stripe, or audio.
EOF
)"
```

---

## Summary

- **Seed ran successfully:** Yes  
- **Demo login email:** `demo@clinix.ai`  
- **Password printed:** No  
- **External APIs called:** No  
- **Backend/AI/frontend logic modified:** No (script + npm script only)  
- **Committed:** No — awaiting approval
