# Clinix.ai

Clinix.ai is a medical transcription and clinical reporting platform. It accepts consultation audio, produces structured clinical documentation with AI assistance, and supports patient, consultation, report, follow-up, subscription, and administration workflows.

## Architecture

The application is composed of three independently deployable services:

- `frontend/`: React, TypeScript, and Vite clinician-facing application.
- `backend-node/`: Node.js, Express, MongoDB, Socket.IO, uploads, PDF, authentication, billing, and integrations API.
- `ai-service/`: FastAPI service for transcription, report generation, SOAP notes, patient briefs, medication safety, and reminders.

Production uses three Linux Azure App Services with Azure Blob Storage for uploaded files and MongoDB Atlas for application data. The browser calls the Node API, which coordinates the AI service using a shared internal API key.

## Requirements

- Node.js and npm
- Python 3.11 to 3.13
- MongoDB or MongoDB Atlas
- FFmpeg and FFprobe for the AI service
- OpenAI credentials for AI processing

Optional integrations require their own credentials: Azure Blob Storage, Stripe, Twilio WhatsApp, Google Cloud Speech, RxNorm, and OpenFDA.

## Local Development

Create local environment files from the templates. These files are intentionally ignored by Git:

```powershell
Copy-Item backend-node/.env.example backend-node/.env
Copy-Item ai-service/.env.example ai-service/.env
Copy-Item frontend/.env.example frontend/.env
```

Set at minimum `MONGODB_URI`, `JWT_SECRET`, and a matching `INTERNAL_API_KEY` in the backend and AI service. Provide `OPENAI_API_KEY` for AI features.

Install and run each service in a separate terminal:

```powershell
Set-Location ai-service
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

```powershell
Set-Location backend-node
npm install
npm run dev
```

```powershell
Set-Location frontend
npm install
npm run dev
```

The local endpoints are frontend `http://localhost:3000`, backend `http://localhost:5000`, and AI service `http://localhost:8001`.

`start-local.ps1` starts the complete local stack on Windows after checking ports and local prerequisites.

## Environment Templates

- `frontend/.env.example`: `VITE_API_URL` and `VITE_SOCKET_URL` are build-time public API endpoints.
- `backend-node/.env.example`: server, MongoDB, authentication, CORS, AI, storage, billing, messaging, and optional external API settings.
- `ai-service/.env.example`: FastAPI, OpenAI, FFmpeg, backend CORS, and internal authentication settings.

Templates contain placeholders only. Never commit `.env` files, credentials, service-account JSON files, or production app settings. Configure production secrets in Azure App Service Application Settings or Azure Key Vault references.

## Production: Azure App Service

`azure-deploy.azcli` provisions and configures the three Linux App Services, enables backend WebSockets, configures storage settings, and documents the ZIP deployment workflow. It reads required secret values from the invoking shell and does not contain production credentials.

Before using it, export the required `*_VALUE` variables in a secure shell session. Build the frontend with its public backend endpoint before packaging because Vite embeds `VITE_API_URL` and `VITE_SOCKET_URL` at build time.

```text
Custom domain -> Azure App Service frontend -> Azure App Service backend -> Azure App Service AI
                                            -> MongoDB Atlas
                                            -> Azure Blob Storage
```

The production custom domain is managed directly through Azure App Services. Docker, Caddy, Cloudflare Tunnel, and VM deployment are not part of the supported production architecture.

## Validation

```powershell
Set-Location frontend
npm run build

Set-Location ../backend-node
node --check src/server.js

Set-Location ../ai-service
python -c "import app.main"
```

## Security

- Rotate any credential that has ever been committed or shared outside its intended secret store.
- Restrict MongoDB Atlas network access and Azure App Service application settings to authorized operators.
- Use a long unique `JWT_SECRET` and `INTERNAL_API_KEY` in production.
- Keep Azure Storage connection strings, Stripe, Twilio, Google, and OpenAI credentials out of source control.

See [SECURITY.md](SECURITY.md) for the repository security policy.