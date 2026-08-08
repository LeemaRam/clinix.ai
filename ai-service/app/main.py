import os
import platform
import shutil
from pathlib import Path
import sys
import tempfile

import fastapi
import openai
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Depends, Header, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .schemas import GenerateReportRequest, GenerateReportResponse, TranscribeResponse, DrugSafetyRequest, DrugSafetyResponse, DrugCheckRequest, PatientBriefRequest, SoapNoteRequest, ExtractFollowupRequest, SendReminderRequest
from .services.drug_safety_service import check_interactions
from .services.patient_brief_service import generate_patient_brief
from .services.soap_note_service import generate_soap_note
from .services.followup_service import extract_followup_from_soap, send_whatsapp_reminder

load_dotenv()

if sys.version_info < (3, 11) or sys.version_info >= (3, 14):
    raise RuntimeError(
        f"Unsupported Python version {sys.version}. "
        "The ai-service requires Python 3.11 or 3.13 for stable audio processing and OpenAI transcription."
    )

from .services.ai_service import transcribe_audio_file, generate_report, check_drug_safety

app = FastAPI(title="Clinix.ai AI Service", version="1.0.0")


def get_internal_api_key() -> str:
    configured_key = str(os.getenv("INTERNAL_API_KEY", "")).strip()
    node_env = str(os.getenv("NODE_ENV", "development")).strip().lower()
    if configured_key:
        return configured_key
    if node_env == "production":
        raise RuntimeError("INTERNAL_API_KEY is required in production")
    return "dev-key-123"


def verify_internal_api_key(x_internal_api_key: str | None = Header(default=None, alias="X-Internal-API-Key")) -> None:
    expected_key = get_internal_api_key()
    if not x_internal_api_key or x_internal_api_key != expected_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def parse_allowed_origins() -> list[str]:
    backend_urls = str(os.getenv("BACKEND_URL", "")).strip()
    origins = {
        origin.strip().rstrip("/")
        for origin in backend_urls.split(",")
        if origin.strip()
    }

    node_env = str(os.getenv("NODE_ENV", "development")).strip().lower()
    if node_env != "production":
        origins.update({
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5000",
            "http://127.0.0.1:5000",
        })

    return sorted(origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_ffmpeg_paths():
    return shutil.which("ffmpeg"), shutil.which("ffprobe")


def _resolve_executable_path(value: str) -> str | None:
    candidate = str(value or "").strip()
    if not candidate:
        return None

    candidate_path = Path(candidate)
    if candidate_path.is_file():
        return str(candidate_path.resolve())

    resolved = shutil.which(candidate)
    return resolved or None


def configure_local_ffmpeg_path() -> dict:
    configured = {
        "ffmpeg_path": None,
        "ffprobe_path": None,
        "configured_ffmpeg_bin": None,
    }

    ffmpeg_override = _resolve_executable_path(str(os.getenv("FFMPEG_PATH", "ffmpeg")).strip() or "ffmpeg")
    ffprobe_override = _resolve_executable_path(str(os.getenv("FFPROBE_PATH", "ffprobe")).strip() or "ffprobe")

    if ffmpeg_override:
        configured["ffmpeg_path"] = ffmpeg_override
        os.environ["FFMPEG_PATH"] = ffmpeg_override

    if ffprobe_override:
        configured["ffprobe_path"] = ffprobe_override
        os.environ["FFPROBE_PATH"] = ffprobe_override

    env_bin = str(os.getenv("FFMPEG_BIN", "")).strip()
    candidates: list[Path] = []

    if env_bin:
        candidates.append(Path(env_bin))

    tools_root = Path(__file__).resolve().parents[1] / "tools" / "ffmpeg"
    if tools_root.exists():
        for bin_dir in tools_root.glob("**/bin"):
            candidates.append(bin_dir)

    for candidate in candidates:
        ffmpeg_candidate = candidate / "ffmpeg"
        ffmpeg_exe_candidate = candidate / "ffmpeg.exe"

        if ffmpeg_candidate.exists() or ffmpeg_exe_candidate.exists():
            os.environ["PATH"] = f"{candidate}{os.pathsep}{os.environ.get('PATH', '')}"
            configured["configured_ffmpeg_bin"] = str(candidate)
            break

    if not configured["ffmpeg_path"]:
        configured["ffmpeg_path"] = _resolve_executable_path("ffmpeg")
    if not configured["ffprobe_path"]:
        configured["ffprobe_path"] = _resolve_executable_path("ffprobe")

    # Pydub respects these process-level paths for ffmpeg/ffprobe invocation.
    if configured["ffmpeg_path"]:
        os.environ["FFMPEG_PATH"] = str(configured["ffmpeg_path"])
    if configured["ffprobe_path"]:
        os.environ["FFPROBE_PATH"] = str(configured["ffprobe_path"])

    return configured


def get_openai_sdk_version():
    return getattr(openai, "__version__", "unknown")


def get_pydantic_version():
    try:
        import pydantic
        return pydantic.__version__
    except ImportError:
        return "unknown"


@app.on_event("startup")
def startup_validation() -> None:
    ffmpeg_config = configure_local_ffmpeg_path()
    ffmpeg_path, ffprobe_path = get_ffmpeg_paths()
    openai_key_present = bool(os.getenv("OPENAI_API_KEY", "").strip())
    internal_api_key_present = bool(str(os.getenv("INTERNAL_API_KEY", "")).strip())
    demo_mode = str(os.getenv("DEMO_MODE", "false")).strip().lower() in {"1", "true", "yes", "on"}
    strict_ffmpeg = str(os.getenv("STRICT_FFMPEG", "true")).strip().lower() in {"1", "true", "yes", "on"}
    node_env = str(os.getenv("NODE_ENV", "development")).strip().lower()

    print("[ai-service] startup validation", {
        "python_version": sys.version.replace("\n", " "),
        "platform": platform.platform(),
        "fastapi_version": fastapi.__version__,
        "pydantic_version": get_pydantic_version(),
        "openai_version": get_openai_sdk_version(),
        "ffmpeg_path": ffmpeg_path,
        "ffprobe_path": ffprobe_path,
        "configured_ffmpeg_bin": ffmpeg_config.get("configured_ffmpeg_bin"),
        "ffmpeg_override": ffmpeg_config.get("ffmpeg_path"),
        "ffprobe_override": ffmpeg_config.get("ffprobe_path"),
        "ffmpeg_available": bool(ffmpeg_path or ffprobe_path),
        "openai_api_key_present": openai_key_present,
        "internal_api_key_present": internal_api_key_present,
        "demo_mode": demo_mode,
        "allowed_origins": parse_allowed_origins(),
    })

    if not openai_key_present:
        raise RuntimeError("OPENAI_API_KEY is required for production transcription")

    if node_env == "production" and not internal_api_key_present:
        raise RuntimeError("INTERNAL_API_KEY is required in production")

    if not (ffmpeg_path or ffprobe_path):
        if strict_ffmpeg:
            raise RuntimeError("FFmpeg/ffprobe not found on PATH. Install FFmpeg and add it to PATH.")
        print("[ai-service] WARNING: FFmpeg/ffprobe not found on PATH. Audio conversion features may fail.")


@app.get("/health")
def health() -> dict:
    ffmpeg_config = configure_local_ffmpeg_path()
    ffmpeg_path, ffprobe_path = get_ffmpeg_paths()
    return {
        "status": "ok",
        "service": "clinix-ai-fastapi",
        "python_version": sys.version.replace("\n", " "),
        "platform": platform.platform(),
        "openai_sdk_version": get_openai_sdk_version(),
        "pydantic_version": get_pydantic_version(),
        "ffmpeg_available": bool(ffmpeg_path or ffprobe_path),
        "configured_ffmpeg_bin": ffmpeg_config.get("configured_ffmpeg_bin"),
        "ffmpeg_override": ffmpeg_config.get("ffmpeg_path"),
        "ffprobe_override": ffmpeg_config.get("ffprobe_path"),
        "ffmpeg_path": ffmpeg_path,
        "ffprobe_path": ffprobe_path,
        "openai_api_key_present": bool(os.getenv("OPENAI_API_KEY", "").strip()),
        "internal_api_key_present": bool(str(os.getenv("INTERNAL_API_KEY", "")).strip()),
        "demo_mode": str(os.getenv("DEMO_MODE", "false")).strip().lower(),
        "allowed_origins": parse_allowed_origins(),
    }


@app.get("/")
def root() -> dict:
    return {"status": "ok", "service": "clinix-ai-fastapi", "docs": "/health"}


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(
    file: UploadFile = File(...),
    speech_language: str = Form("en"),
    consultation_id: str = Form(""),
    _auth: None = Depends(verify_internal_api_key),
):
    # Initialize variables safely to prevent scope issues
    speech_language = speech_language or "en"
    consultation_id = consultation_id or ""

    print(f"[ai-service] /transcribe request started consultation_id={consultation_id} speech_language={speech_language}")

    if not file or not file.filename:
        print(f"[ai-service] /transcribe failed: missing file consultation_id={consultation_id}")
        raise HTTPException(status_code=400, detail="Missing file")

    suffix = ".webm"
    if "." in file.filename:
        suffix = file.filename[file.filename.rfind("."):]

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file_content = await file.read()
            if not file_content:
                print(f"[ai-service] /transcribe failed: empty file consultation_id={consultation_id}")
                raise HTTPException(status_code=400, detail="Uploaded file is empty")
            tmp.write(file_content)
            temp_path = tmp.name

        file_size = len(file_content)
        print(
            f"[ai-service] /transcribe file saved temp_path={temp_path} "
            f"filename={file.filename} content_type={file.content_type} size={file_size} "
            f"consultation_id={consultation_id}"
        )

        result = transcribe_audio_file(temp_path, speech_language=speech_language, consultation_id=consultation_id)
        print(
            f"[ai-service] /transcribe completed consultation_id={consultation_id} "
            f"language={result.get('language')} duration={result.get('duration')} "
            f"confidence_score={result.get('confidence_score')} segments={len(result.get('segments', []))}"
        )
        return result
    except Exception as exc:
        print(f"[ai-service] /transcribe failed consultation_id={consultation_id} speech_language={speech_language} error={exc}")
        raise HTTPException(status_code=502, detail=str(exc))
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
                print(f"[ai-service] /transcribe temp file cleaned up consultation_id={consultation_id}")
            except OSError:
                pass



@app.post("/generate-report", response_model=GenerateReportResponse)
def generate_report_endpoint(payload: GenerateReportRequest, _auth: None = Depends(verify_internal_api_key)):
    try:
        data = generate_report(
            transcription_text=payload.transcription_text,
            consultation_type=payload.consultation_type,
            language=payload.language,
        )
        return data
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/drug-safety", response_model=DrugSafetyResponse)
def drug_safety_endpoint(payload: DrugSafetyRequest, _auth: None = Depends(verify_internal_api_key)):
    try:
        data = check_drug_safety(
            medications=payload.medications,
            patient_info=payload.patient_info,
            patient_files=payload.patient_files,
            language=payload.language,
        )
        return data
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/drug-check")
def drug_check(payload: DrugCheckRequest, _auth: None = Depends(verify_internal_api_key)):
    return check_interactions(payload.new_drugs, payload.existing_drugs)


@app.post("/patient-brief")
def patient_brief_endpoint(payload: PatientBriefRequest, _auth: None = Depends(verify_internal_api_key)):
    return generate_patient_brief(
        payload.patient,
        payload.recentConsultations,
        payload.reports,
        patient_files=payload.patient_files,
    )


@app.post("/soap-note")
def soap_note_endpoint(payload: SoapNoteRequest, _auth: None = Depends(verify_internal_api_key)):
    return generate_soap_note(
        transcription=payload.transcription,
        patient_data=payload.patient,
        consultation_reason=payload.consultation_reason,
        existing_notes=payload.existing_notes,
    )


@app.post("/extract-followup")
def extract_followup_endpoint(payload: ExtractFollowupRequest, _auth: None = Depends(verify_internal_api_key)):
    return extract_followup_from_soap(payload.soap_note, payload.consultation_id)


@app.post("/send-reminder")
def send_reminder_endpoint(payload: SendReminderRequest, _auth: None = Depends(verify_internal_api_key)):
    return send_whatsapp_reminder(
        payload.patient_phone, payload.patient_name, payload.doctor_name,
        payload.follow_up_date, payload.reason
    )


if __name__ == "__main__":
    import uvicorn
    host = str(os.getenv("AI_SERVICE_HOST", "0.0.0.0")).strip() or "0.0.0.0"
    port = int(os.getenv("PORT", os.getenv("AI_SERVICE_PORT", "8001")))
    uvicorn.run(app, host=host, port=port)
