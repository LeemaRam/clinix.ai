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

- `AI_SERVICE_PORT` - service port (default `8001`)
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_TRANSCRIBE_MODEL` - whisper model (`whisper-1`)
- `OPENAI_CHAT_MODEL` - chat model (`gpt-4o-mini`)
- `MAX_FILE_MB` - max file size

## Run

```bash
python3 -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
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
