import os
import tempfile
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .schemas import GenerateReportRequest, GenerateReportResponse, TranscribeResponse
from .services.ai_service import transcribe_audio_file, generate_report

load_dotenv()

app = FastAPI(title="Clinix.ai AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {"status": "ok", "service": "clinix-ai-fastapi", "docs": "/health"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "clinix-ai-fastapi"}


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    speech_language: str = Form("en"),
    consultation_id: str = Form(""),
):
    del consultation_id

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file")

    suffix = ".webm"
    if "." in file.filename:
        suffix = file.filename[file.filename.rfind("."):]

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        temp_path = tmp.name

    try:
        result = transcribe_audio_file(temp_path, speech_language=speech_language)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass


@app.post("/generate-report", response_model=GenerateReportResponse)
def generate_report_endpoint(payload: GenerateReportRequest):
    try:
        data = generate_report(
            transcription_text=payload.transcription_text,
            consultation_type=payload.consultation_type,
            language=payload.language,
        )
        return data
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
