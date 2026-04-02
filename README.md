# Clinix.ai

Clinix.ai is a hybrid medical transcription and reporting platform designed to turn consultation audio into structured clinical documentation. The current architecture separates the user interface, orchestration API, and AI processing into dedicated services so each layer can evolve independently.

## Overview

Clinix.ai is organized as a three-service application:

- `frontend/` is the React application built with Vite and TypeScript. It provides the clinician-facing UI for patients, consultations, reports, subscriptions, and settings.
- `backend-node/` is the main Node.js + Express API layer. It handles authentication, patient and consultation data, subscriptions, uploads, PDFs, dashboards, and Socket.IO events.
- `ai-service/` is the FastAPI service that performs AI-heavy processing such as transcription and report generation.
- `backend-legacy/` contains the deprecated Flask backend and is kept only as reference material.

## Why a Hybrid Architecture

The migration away from a monolithic Flask backend was done to improve separation of concerns and make the platform easier to maintain.

Benefits of the current design:

- Frontend and backend can be developed and deployed independently.
- The Node.js API focuses on orchestration, validation, persistence, and real-time communication.
- The Python AI service can use the best Python ecosystem for audio and LLM workflows without pulling that complexity into the main API.
- The system scales more cleanly because AI workloads are isolated from standard CRUD traffic.
- The legacy Flask code can be retired gradually without blocking the active product path.

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios
- React Hook Form
- React Toastify
- i18next and react-i18next
- Zustand
- Socket.IO client support where needed

### Backend API Layer

- Node.js
- Express
- MongoDB with Mongoose
- Socket.IO
- JWT authentication
- Multer for uploads
- PDF generation with PDFKit
- Stripe integration
- CORS, Helmet, Morgan, and dotenv

### AI Service

- Python 3
- FastAPI
- OpenAI API
- Pydub for audio handling
- FFmpeg-backed audio processing
- Pydantic and python-multipart
- Uvicorn for serving the API

## Project Structure

```text
clinix.ai/
  backend-node/            # Main Express API layer
    src/
      app.js
      server.js
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
      utils/
    .env.example
    package.json
  ai-service/              # FastAPI AI processing service
    app/
      main.py
      schemas.py
      services/
    .env.example
    requirements.txt
  frontend/                # React + Vite frontend
    src/
      components/
      context/
      i18n/
      pages/
      services/
      types/
      utils/
    vite.config.ts
    package.json
  backend-legacy/          # Deprecated Flask backend retained for reference
```

## Prerequisites

Install the following before running the project:

- Node.js 18+ and npm
- Python 3.10+ with pip
- MongoDB
- FFmpeg
- OpenAI API key for transcription and report generation
- Stripe credentials if you want billing features enabled

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/LeemaRam/clinix.ai.git
cd clinix.ai
```

### 2. backend-node setup

```bash
cd backend-node
npm install
```

Create `backend-node/.env` from `backend-node/.env.example` and configure these values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/clinix_ai
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
PYTHON_AI_SERVICE_URL=http://localhost:8001
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
MAX_UPLOAD_SIZE_MB=1024
```

### 3. ai-service setup

```bash
cd ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `ai-service/.env` from `ai-service/.env.example` and configure these values:

```env
AI_SERVICE_PORT=8001
OPENAI_API_KEY=your_openai_api_key
OPENAI_TRANSCRIBE_MODEL=whisper-1
OPENAI_CHAT_MODEL=gpt-4o-mini
MAX_FILE_MB=1024
```

### 4. frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

## Running the Application

Run each service in its own terminal.

### Terminal 1: backend-node

```bash
cd backend-node
npm run dev
```

The Node API runs on `http://localhost:5000`.

### Terminal 2: ai-service

```bash
cd ai-service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

The FastAPI service runs on `http://localhost:8001` by default. If you want to use port `8000` instead, update `AI_SERVICE_PORT` and the Node service URL accordingly.

### Terminal 3: frontend

```bash
cd frontend
npm run dev
```

The Vite dev server runs on `http://localhost:3000`.

## End-to-End API Flow

The typical request path is:

Frontend → Node API → FastAPI AI Service → OpenAI → Node API → Frontend

A typical consultation flow looks like this:

1. The clinician logs in through the React frontend.
2. The frontend sends requests to the Node API for patients, consultations, reports, and subscriptions.
3. When audio is uploaded, Node stores the file and forwards it to the FastAPI AI service.
4. The FastAPI service calls OpenAI for transcription or report generation.
5. The AI response is returned to Node for persistence and response shaping.
6. Node returns the final result to the frontend for display, preview, or PDF generation.

## Environment Variables

### frontend/.env

- `VITE_API_URL` - Base URL for the Node API. In local development this is typically `http://localhost:5000`.

### backend-node/.env

- `PORT` - Express server port. Default `5000`.
- `MONGODB_URI` - MongoDB connection string.
- `JWT_SECRET` - JWT signing secret.
- `JWT_EXPIRES_IN` - JWT lifetime.
- `CORS_ORIGIN` - Allowed frontend origin(s).
- `PYTHON_AI_SERVICE_URL` - FastAPI service URL used by Node when sending audio for transcription.
- `STRIPE_SECRET_KEY` - Stripe secret key.
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret.
- `STRIPE_SUCCESS_URL` - Redirect URL after successful checkout.
- `STRIPE_CANCEL_URL` - Redirect URL after canceled checkout.
- `MAX_UPLOAD_SIZE_MB` - Maximum upload size in megabytes.

### ai-service/.env

- `AI_SERVICE_PORT` - FastAPI port. Default `8001`.
- `OPENAI_API_KEY` - OpenAI API key.
- `OPENAI_TRANSCRIBE_MODEL` - Model used for transcription.
- `OPENAI_CHAT_MODEL` - Model used for report generation.
- `MAX_FILE_MB` - Maximum audio file size in megabytes.

## Features

- Role-based authentication for clinicians and administrators
- Patient management and consultation lifecycle tracking
- Browser recording and audio upload workflows
- AI transcription and structured report generation
- Editable report previews and PDF export
- Subscription plans and Stripe checkout support
- Dashboard metrics and operational views
- Internationalized UI support
- Socket.IO-based real-time updates

## API Surface

The Node API exposes the application routes consumed by the frontend, including:

- Authentication and user profile routes
- Patient CRUD routes
- Consultation and transcription routes
- Report generation and export routes
- Subscription and plan routes
- Dashboard and super-admin routes
- Socket.IO events for live consultation updates

The AI service exposes:

- `GET /health`
- `POST /transcribe`
- `POST /generate-report`

## Deprecated Legacy Backend

The old Flask backend is preserved in `backend-legacy/` for reference only.

- It is not the active runtime path.
- New development should target `frontend/`, `backend-node/`, and `ai-service/`.
- Do not rely on legacy Flask instructions when setting up or running the project.

## Notes

- The current browser-facing development setup uses Vite on port `3000` and proxies API requests to the Node server on `5000`.
- The Node service delegates AI work to the FastAPI service instead of calling OpenAI directly.
- The repository has been migrated away from the monolithic Flask backend, so any old Flask-only setup steps should be treated as historical only.

## License

This project is licensed under the MIT License.
