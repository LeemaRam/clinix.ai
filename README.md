# Clinix.ai

Clinix.ai is a hybrid medical transcription platform that turns consultation audio into structured clinical output. It combines a React dashboard, a Node.js orchestration API, and a FastAPI AI service so clinicians can manage patients, consultations, reports, follow-ups, appointments, and subscriptions in one place.

## What the platform does

Clinix.ai is built to help medical teams move from audio capture to actionable records faster.

- Transcribes consultation audio into speaker-aware dialogue segments.
- Generates SOAP notes, patient briefs, drug safety checks, and follow-up summaries.
- Stores patient, consultation, appointment, and report data in MongoDB.
- Supports real-time updates through Socket.IO.
- Provides role-based access for doctors, admins, and super admins.
- Includes a modern frontend for reviewing consultations, reports, analytics, and subscriptions.

## Architecture

The repository is organized as a three-service application:

<<<<<<< HEAD
## Local Runtime Testing

To run the full platform locally, start the services in this order:

1. **AI service** (`ai-service`) on port `8001`
2. **Backend API** (`backend-node`) on port `5000`
3. **Frontend** (`frontend`) on port `3000`

### Local startup commands

```powershell
cd ai-service
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

```powershell
cd backend-node
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

### Local environment variables

- `backend-node/.env.example` is now configured for development by default.
- `frontend/.env.example` uses `VITE_API_URL=http://localhost:5000`.
- `ai-service/.env.example` is configured to run locally on port `8001`.

### Local connectivity checks

- Frontend API calls use `VITE_API_URL` when configured, otherwise Vite proxying to `/api`.
- Socket.IO connects to `/socket.io` through the frontend dev proxy in development mode.
- Backend uses `PYTHON_AI_SERVICE_URL=http://localhost:8001` by default.
- Backend now creates upload directories on startup if they are missing.

Benefits of the current design:
=======
- `frontend/` - React 18 + Vite + TypeScript UI.
- `backend-node/` - Express API for authentication, persistence, uploads, dashboards, and orchestration.
- `ai-service/` - FastAPI service for transcription and AI-assisted clinical workflows.
- `backend-legacy/` - Deprecated Flask backend kept only for reference.
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

Request flow:

`Frontend -> Node API -> FastAPI AI Service -> AI provider -> Node API -> Frontend`

## Key features

### Frontend

- Clinician dashboard with patient and consultation management.
- Registration and login flows.
- Past consultations view with speaker-colored transcription segments.
- Pages for reports, analytics, appointments, follow-ups, pricing, and settings.
- Super admin pages for user, language, and subscription-plan management.

### Backend API

- JWT-based authentication.
- Patient, consultation, report, appointment, and follow-up APIs.
- File upload handling for consultation audio.
- Socket.IO support for live updates.
- PDF generation and subscription support.

### AI service

- Audio transcription endpoint.
- SOAP note generation.
- Drug safety and interaction analysis.
- Patient brief generation.
- Follow-up extraction and reminder helpers.

## Tech stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Axios
- Zustand
- React Hook Form
- React Toastify
- i18next
- Socket.IO client

### Backend

- Node.js
- Express
- MongoDB + Mongoose
- Socket.IO
- JWT
- Multer
- PDFKit
- Stripe
- Twilio
- `mongodb-memory-server` for local fallback storage

### AI service

- FastAPI
- Uvicorn
- Pydantic
- python-multipart
- OpenAI / Gemini integration
- Audio and clinical helper workflows

## Repository layout

```text
clinix.ai/
  backend-node/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      services/
      utils/
    .env.example
    package.json
  ai-service/
    app/
      main.py
      schemas.py
      services/
    .env.example
    requirements.txt
  frontend/
    src/
      components/
      context/
      i18n/
      pages/
      services/
      utils/
    package.json
  backend-legacy/
  docker-compose.yml
```

## Prerequisites

Install the following before running the project locally:

- Node.js 18+ and npm
- Python 3.10+ with pip
- MongoDB Atlas or local MongoDB
- FFmpeg for audio handling
- OpenAI API key if you want live transcription
- Gemini API key if you want live AI-generated clinical summaries

## Environment setup

Never commit real secrets to the repository. Use local `.env` files instead.

### `backend-node/.env`

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/clinix_ai
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
DEMO_MODE=false
PYTHON_AI_SERVICE_URL=http://localhost:8001
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=http://localhost:3000/subscription/success
STRIPE_CANCEL_URL=http://localhost:3000/subscription/cancel
MAX_UPLOAD_SIZE_MB=1024
```

### `ai-service/.env`

```env
AI_SERVICE_PORT=8001
GEMINI_API_KEY=replace-with-your-gemini-key
DEMO_MODE=true
MAX_FILE_MB=1024
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:5000
```

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/LeemaRam/clinix.ai.git
cd clinix.ai
```

### 2. Install the backend

```bash
cd backend-node
npm install
```

### 3. Install the AI service dependencies

```bash
cd ../ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Install the frontend

```bash
cd ../frontend
npm install
```

## Running locally

Run each service in its own terminal.

### Terminal 1: backend API

```bash
cd backend-node
npm run dev
```

Default port: `http://localhost:5000`

### Terminal 2: AI service

```bash
cd ai-service
.\.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Default port: `http://localhost:8001`

### Terminal 3: frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Default port: `http://localhost:3000`

## Local data persistence

The backend first tries to connect to the configured MongoDB URI. If that fails during local development, it falls back to a local MongoDB-compatible store in `backend-node/.mongo-data` so newly created users and other records can persist across restarts.

## Main routes

### Frontend routes

- `/` - dashboard
- `/login` and `/register` - authentication
- `/patients` - patient list
- `/patients/:id` - patient details
- `/patients/:id/edit` - patient edit
- `/new-consultation` - new consultation flow
- `/past-consultations` - transcription history
- `/reports` - reports
- `/analytics` - analytics dashboard
- `/appointments` - appointments
- `/follow-ups` - follow-up management
- `/pricing` - subscription pricing
- `/super-admin/*` - super admin views

### Backend API highlights

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/patients`
- `POST /api/consultations`
- `GET /api/reports`
- `GET /api/dashboard/stats`
- `GET /api/appointments`
- `GET /api/followups`

### AI service endpoints

- `GET /health`
- `POST /transcribe`
- `POST /generate-report`
- `POST /drug-safety`
- `POST /drug-check`
- `POST /patient-brief`
- `POST /soap-note`
- `POST /extract-followup`
- `POST /send-reminder`

<<<<<<< HEAD
Clinix.ai includes a complete Stripe integration for subscription management. The full Stripe setup and configuration are consolidated in a single guide.
=======
## Notes for contributors
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

- Keep secrets in local `.env` files only.
- Do not commit generated database data, uploads, or build artifacts.
- The legacy Flask backend is preserved for reference, but the active application uses the Node.js + FastAPI stack.

## Deployment

<<<<<<< HEAD
### Detailed Setup

For comprehensive setup instructions, see:
- **[STRIPE_SETUP.md](STRIPE_SETUP.md)** - Complete Stripe integration guide

### Features

- Subscription plan management (monthly & yearly)
- Stripe Checkout integration
- Webhook handling for payment events
- User subscription tracking in MongoDB
- Trial period support
- Plan cancellation and reactivation
- Feature limits per subscription tier

### API Endpoints

**Public Endpoints (No Auth Required)**
- `GET /api/subscriptions/plans` - List all active plans
- `GET /api/subscriptions/plans/:id` - Get specific plan
- `POST /api/subscriptions/compare` - Compare multiple plans

**Protected Endpoints (JWT Required)**
- `POST /api/subscriptions/checkout` - Create Stripe checkout session
- `GET /api/subscriptions/user` - Get user's current subscription
- `POST /api/subscriptions/cancel` - Cancel subscription at period end
- `POST /api/subscriptions/reactivate` - Reactivate cancelled subscription

**Webhooks**
- `POST /api/subscriptions/webhook` - Stripe webhook (uses signature verification)

### Subscription Tiers

**Starter Plan**
- $29/month or $290/year
- 120 transcriptions per month
- 10 GB storage
- Basic analytics

**Pro Plan**
- $79/month or $790/year
- 600 transcriptions per month
- 80 GB storage
- Priority support
- Team collaboration

### MongoDB Collections

**SubscriptionPlan**
Stores available subscription plans linked to Stripe prices:
```javascript
{
  name: "Pro",
  price: 79,
  currency: "usd",
  interval: "month",
  transcriptionsPerMonth: 600,
  diskSpaceGB: 80,
  features: [...],
  stripePriceId: "price_XXXXX",  // Linked to Stripe
  active: true
}
```

**UserSubscription**
Tracks user subscription status:
```javascript
{
  userId: ObjectId,
  planId: ObjectId,
  stripeSubscriptionId: "sub_XXXXX",
  stripeCustomerId: "cus_XXXXX",
  status: "active",  // or "past_due", "cancelled"
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: false
}
```

### Testing

Use Stripe test cards during development:
```
Card Number: 4242 4242 4242 4242
Expiry:      12/25 (any future date)
CVC:         123 (any 3 digits)
```

For other test scenarios, see [Stripe Testing Documentation](https://stripe.com/docs/testing).

### Production Deployment

#### Prerequisites

1. **Domain and SSL Certificate**: Obtain a domain name and SSL certificate for HTTPS
2. **Cloud Infrastructure**: Choose a cloud provider (AWS, GCP, Azure, DigitalOcean, etc.)
3. **Database**: Set up MongoDB Atlas or equivalent managed MongoDB service
4. **File Storage**: Configure cloud storage for file uploads (AWS S3, Google Cloud Storage, etc.)
5. **Reverse Proxy**: Set up nginx or similar for load balancing and SSL termination

#### Environment Configuration

1. **Copy environment templates**:
   ```bash
   cp backend-node/.env.example backend-node/.env
   cp frontend/.env.example frontend/.env
   cp ai-service/.env.example ai-service/.env
   ```

2. **Configure production environment variables**:

   **Backend (.env)**:
   ```env
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/clinix_prod
   JWT_SECRET=your-super-secure-jwt-secret-here
   CORS_ORIGIN=https://yourdomain.com
   FRONTEND_URL=https://yourdomain.com
   MAX_UPLOAD_SIZE_MB=50
   # Add all other required API keys
   ```

   **Frontend (.env)**:
   ```env
   VITE_API_URL=https://api.yourdomain.com
   ```

   **AI Service (.env)**:
   ```env
   NODE_ENV=production
   OPENAI_API_KEY=your-production-openai-key
   # Add other AI service keys
   ```

#### Docker Deployment

1. **Build and push images**:
   ```bash
   # Build images
   docker-compose build

   # Tag and push to registry
   docker tag clinix-frontend your-registry/clinix-frontend:latest
   docker tag clinix-backend your-registry/clinix-backend:latest
   docker tag clinix-ai-service your-registry/clinix-ai-service:latest
   docker push your-registry/clinix-frontend:latest
   docker push your-registry/clinix-backend:latest
   docker push your-registry/clinix-ai-service:latest
   ```

2. **Production docker-compose.yml**:
   ```yaml
   version: '3.9'
   services:
     ai-service:
       image: your-registry/clinix-ai-service:latest
       environment:
         - NODE_ENV=production
       restart: unless-stopped

     backend:
       image: your-registry/clinix-backend:latest
       environment:
         - NODE_ENV=production
       depends_on:
         - ai-service
       restart: unless-stopped

     frontend:
       image: your-registry/clinix-frontend:latest
       environment:
         - API_URL=https://api.yourdomain.com
       restart: unless-stopped
   ```

#### Security Checklist

- [ ] All `.env` files contain production values only
- [ ] No sensitive data in `.env.example` files
- [ ] JWT secrets are strong and unique
- [ ] CORS is restricted to your domain only
- [ ] HTTPS is enabled with valid SSL certificate
- [ ] File upload limits are reasonable (50MB max)
- [ ] Rate limiting is configured
- [ ] Security headers are enabled (Helmet.js)
- [ ] Database connections use authentication
- [ ] API keys are production keys, not test keys

#### Monitoring and Maintenance

1. **Health Checks**: All services have `/health` endpoints
2. **Logging**: Configure centralized logging (CloudWatch, Stackdriver, etc.)
3. **Backups**: Set up automated database backups
4. **SSL Renewal**: Configure automatic SSL certificate renewal
5. **Updates**: Plan for dependency updates and security patches

#### Performance Optimization

- [ ] Enable gzip compression in nginx
- [ ] Configure proper cache headers for static assets
- [ ] Set up CDN for static file delivery
- [ ] Configure database connection pooling
- [ ] Implement Redis for session storage if needed
- [ ] Monitor and optimize database queries

Before deploying to production:

1. Switch to **Live Mode** in Stripe Dashboard
2. Copy Live API keys (start with `sk_live_`)
3. Create Stripe products again in Live mode
4. Update Azure environment variables with Live keys
5. Set up webhook for your Azure domain
6. Use Live pricing in seeder script

See **[STRIPE_SETUP.md](STRIPE_SETUP.md)** for detailed Azure deployment steps.
## Deprecated Legacy Backend

The old Flask backend is preserved in `backend-legacy/` for reference only.

- It is not the active runtime path.
- New development should target `frontend/`, `backend-node/`, and `ai-service/`.
- Do not rely on legacy Flask instructions when setting up or running the project.

## Notes

- The current browser-facing development setup uses Vite on port `3000` and proxies API requests to the Node server on `5000`.
- The Node service delegates AI work to the FastAPI service instead of calling OpenAI directly.
- The repository has been migrated away from the monolithic Flask backend, so any old Flask-only setup steps should be treated as historical only.
=======
A root `docker-compose.yml` is included for local multi-service development. The services can also be containerized independently for cloud deployment.
>>>>>>> e9d40771003615655a40fd8a081945f378b3b280

## License

No license file is currently included in this repository.
