# Clinix.ai AI Service (FastAPI)

This service handles AI-heavy tasks for transcription and report generation.

## Endpoints

- `GET /health`
- `POST /transcribe` (multipart form)
  - `file` (audio)
  - `speech_language` (`en` or `ur`)
  - `consultation_id` (optional)
- `POST /generate-report` (JSON)
  - `transcription_text`
  - `consultation_type`
  - `language`

## Environment Variables

Copy `.env.example` to `.env`:

- `PORT` - Azure App Service injected listener port (default `8000`)
- `AI_SERVICE_PORT` - local fallback port when `PORT` is not set (default `8001`)
- `AI_SERVICE_HOST` - host binding (default `0.0.0.0`)
- `BACKEND_URL` - comma-separated allowed CORS origin(s), e.g. `https://<backend-app>.azurewebsites.net`
- `OPENAI_API_KEY` - OpenAI API key for report generation and structured analysis
- `OPENAI_MODEL` - OpenAI model to use for generation (default `gpt-4o-mini`)
- `DEMO_MODE` - when `true`, allows deterministic fallback behavior for transcription/demo flows
- `MAX_FILE_MB` - max file size
- `FFMPEG_PATH` - ffmpeg executable/command (default `ffmpeg`)
- `FFPROBE_PATH` - ffprobe executable/command (default `ffprobe`)
- `FFMPEG_BIN` - optional local Windows folder containing `ffmpeg.exe` and `ffprobe.exe`

## Run

```bash
python3 -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Production startup for Azure App Service (Linux Python runtime):

```bash
gunicorn --worker-class uvicorn.workers.UvicornWorker --workers 2 --timeout 180 --bind 0.0.0.0:$PORT app.main:app
```

Health check:

```bash
curl http://localhost:8001/health
```

## API Examples

Transcribe:

```bash
curl -X POST http://localhost:8001/transcribe \
  -F "file=@/tmp/sample.webm" \
  -F "speech_language=en" \
  -F "consultation_id=123"
```

Generate report:

```bash
curl -X POST http://localhost:8001/generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "transcription_text": "Patient reports mild headache for 2 days.",
    "consultation_type": "general",
    "language": "en"
  }'
```
