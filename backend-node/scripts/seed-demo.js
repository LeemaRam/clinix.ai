#!/usr/bin/env node

/**
 * FYP demo database seeder — offline-safe, no external APIs.
 *
 * Seeds: 1 demo doctor, 2 patients, 1 transcribed consultation, 1 SOAP report.
 * Does NOT call OpenAI, Twilio, Stripe, or the AI service. No audio upload.
 *
 * Usage (from backend-node/):
 *   DEMO_DOCTOR_PASSWORD='your-password' npm run seed:demo
 *   npm run seed:demo -- --password 'your-password'
 *
 * Production guard: set NODE_ENV=production only with --force (not recommended).
 */

import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { Patient } from '../src/models/Patient.js';
import { Consultation } from '../src/models/Consultation.js';
import { Report } from '../src/models/Report.js';

dotenv.config();

const DEMO_DOCTOR_EMAIL = 'demo@clinix.ai';
const DEMO_CONSULTATION_KEY = 'fyp-demo-consultation';
const DEMO_REPORT_KEY = 'fyp-demo-report';

const DEMO_TRANSCRIPT =
  'Patient is a 24-year-old male with known type 2 diabetes taking Metformin. He reports worsening right lower abdominal discomfort, nausea, and constipation for three days. No severe vomiting or bleeding reported. Doctor discussed hydration, diet, medication adherence, warning signs, and follow-up if symptoms persist.';

const DEMO_SOAP_CONTENT = `Subjective:
24-year-old male with type 2 diabetes on Metformin reports three days of right lower abdominal discomfort, nausea, and constipation. No severe vomiting, bleeding, or acute distress reported.

Objective:
Patient appears stable during consultation. No vitals recorded in this demo dataset. Symptoms are consistent with a gastrointestinal complaint requiring monitoring.

Assessment:
Right lower abdominal discomfort with constipation and nausea. Type 2 diabetes history noted. Differential includes constipation-related abdominal pain, gastrointestinal upset, and need to monitor for worsening abdominal symptoms.

Plan:
Advise hydration, fiber intake, medication adherence, and symptom monitoring. Educate patient about warning signs including worsening pain, fever, persistent vomiting, blood in stool, or severe weakness. Follow up if symptoms persist or worsen.`;

function getCliArg(name) {
  const prefix = `${name}=`;
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : undefined;
}

function describeMongoTarget(uri) {
  const sanitized = uri.replace(/\/\/[^@]+@/, '//***@');
  const match = sanitized.match(/mongodb(?:\+srv)?:\/\/(?:[^/]+)(?:\/([^?]+))?/);
  return {
    host: match ? sanitized.match(/mongodb(?:\+srv)?:\/\/([^/]+)/)?.[1] ?? 'unknown' : 'unknown',
    database: match?.[1] ?? '(default)',
    sanitizedUri: sanitized.split('?')[0],
  };
}

function assertSafeToRun() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || !mongoUri.trim()) {
    console.error('❌ MONGODB_URI is required. Set it in backend-node/.env or the environment.');
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const force = process.argv.includes('--force');
  if (isProduction && !force) {
    console.error('❌ Refusing to seed while NODE_ENV=production. Pass --force only if you are certain this is not a live database.');
    process.exit(1);
  }

  const password = process.env.DEMO_DOCTOR_PASSWORD || getCliArg('--password');
  if (!password || !password.trim()) {
    console.error('❌ Demo doctor password is required.');
    console.error('   Set DEMO_DOCTOR_PASSWORD in the environment, or run:');
    console.error('   npm run seed:demo -- --password "your-demo-password"');
    process.exit(1);
  }

  return { mongoUri: mongoUri.trim(), password: password.trim() };
}

async function upsertDemoDoctor(password) {
  const passwordHash = await bcrypt.hash(password, 10);
  const doctor = await User.findOneAndUpdate(
    { email: DEMO_DOCTOR_EMAIL },
    {
      $set: {
        email: DEMO_DOCTOR_EMAIL,
        fullName: 'Dr. Demo Clinician',
        role: 'doctor',
        passwordHash,
        isActive: true,
        language: 'en',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doctor;
}

async function upsertDemoPatient(doctorId, profile) {
  const { ...fields } = profile;
  const patient = await Patient.findOneAndUpdate(
    { doctorId, firstName: fields.firstName, lastName: fields.lastName },
    {
      $set: {
        ...fields,
        doctorId,
        status: 'active',
        notes: [
          {
            content: '[FYP demo seed data — safe for local presentations]',
            createdBy: doctorId,
          },
        ],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return patient;
}

async function upsertDemoConsultation(doctorId, patientId) {
  const now = new Date();
  const consultation = await Consultation.findOneAndUpdate(
    { doctorId, 'metadata.demoSeedKey': DEMO_CONSULTATION_KEY },
    {
      $set: {
        patientId,
        doctorId,
        consultationType: 'general',
        recordingType: 'doctor_patient',
        consentObtained: true,
        consentTimestamp: now,
        status: 'transcribed',
        startedAt: now,
        endedAt: now,
        notes: DEMO_TRANSCRIPT,
        consultationSummary: DEMO_TRANSCRIPT,
        languageDetected: 'en',
        soapApprovalStatus: 'approved',
        drugCheckStatus: 'completed',
        metadata: {
          demoSeed: true,
          demoSeedKey: DEMO_CONSULTATION_KEY,
          transcript: DEMO_TRANSCRIPT,
          source: 'fyp-demo-seed',
        },
        medicalInfo: {
          chiefComplaint: 'Right lower abdominal discomfort with nausea and constipation',
          history: 'Type 2 diabetes on Metformin',
          assessment: 'Gastrointestinal complaint requiring monitoring',
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return consultation;
}

async function upsertDemoReport(doctorId, patientId, consultationId) {
  const report = await Report.findOneAndUpdate(
    { doctorId, 'options.demoSeedKey': DEMO_REPORT_KEY },
    {
      $set: {
        consultationId,
        patientId,
        doctorId,
        content: DEMO_SOAP_CONTENT,
        format: 'SOAP',
        status: 'generated',
        generatedBy: 'fyp-demo-seed',
        options: {
          demoSeed: true,
          demoSeedKey: DEMO_REPORT_KEY,
          source: 'fyp-demo-seed',
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return report;
}

async function main() {
  const { mongoUri, password } = assertSafeToRun();
  const target = describeMongoTarget(mongoUri);

  console.log('🌱 Clinix.ai FYP demo seed');
  console.log(`   Mongo host: ${target.host}`);
  console.log(`   Database:   ${target.database}`);
  console.log(`   Target URI: ${target.sanitizedUri}`);
  console.log('   External APIs: none (OpenAI/Twilio/Stripe/AI service not called)\n');

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  const doctor = await upsertDemoDoctor(password);
  console.log(`👨‍⚕️ Demo doctor upserted: ${doctor.email}`);

  const patientOne = await upsertDemoPatient(doctor._id, {
    firstName: 'M',
    lastName: 'Ali',
    gender: 'male',
    dateOfBirth: new Date('2002-02-02'),
    email: 'm.ali.demo@example.com',
    phone: '+92-300-0000001',
    address: 'Demo Street, Lahore, PK',
    medicalConditions: ['Type 2 diabetes'],
    currentMedications: ['Metformin'],
    allergies: [],
    lastVisit: new Date(),
  });

  const patientTwo = await upsertDemoPatient(doctor._id, {
    firstName: 'Ahmed',
    lastName: 'Raza',
    gender: 'male',
    dateOfBirth: new Date('1990-01-01'),
    email: 'ahmed.raza.demo@example.com',
    phone: '+92-300-0000002',
    address: 'Demo Avenue, Karachi, PK',
    medicalConditions: [],
    currentMedications: [],
    allergies: [],
  });

  const consultation = await upsertDemoConsultation(doctor._id, patientOne._id);
  const report = await upsertDemoReport(doctor._id, patientOne._id, consultation._id);

  console.log(`🧑‍🤝‍🧑 Patients upserted: 2 (${patientOne.firstName} ${patientOne.lastName}, ${patientTwo.firstName} ${patientTwo.lastName})`);
  console.log(`🩺 Consultation ID: ${consultation._id}`);
  console.log(`📄 Report ID:       ${report._id}`);
  console.log('\n✅ Demo seed completed successfully.');
  console.log(`\nLogin with email ${DEMO_DOCTOR_EMAIL} and the password you provided in DEMO_DOCTOR_PASSWORD.`);
  console.log('(Password is not printed.)');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ Demo seed failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors during failure
  }
  process.exit(1);
});
