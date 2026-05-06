import os
import tempfile
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from .schemas import GenerateReportRequest, GenerateReportResponse, TranscribeResponse, DrugSafetyRequest, DrugSafetyResponse, DrugCheckRequest, PatientBriefRequest, SoapNoteRequest, ExtractFollowupRequest, SendReminderRequest
from .services.ai_service import transcribe_audio_file, generate_report, check_drug_safety
from .services.drug_safety_service import check_interactions
from .services.patient_brief_service import generate_patient_brief
from .services.soap_note_service import generate_soap_note
from .services.followup_service import extract_followup_from_soap, send_whatsapp_reminder

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


@app.post("/drug-safety", response_model=DrugSafetyResponse)
def drug_safety_endpoint(payload: DrugSafetyRequest):
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
def drug_check(payload: DrugCheckRequest):
    return check_interactions(payload.new_drugs, payload.existing_drugs)


@app.post("/patient-brief")
def patient_brief_endpoint(payload: PatientBriefRequest):
    return generate_patient_brief(
        payload.patient,
        payload.recentConsultations,
        payload.reports,
        patient_files=payload.patient_files,
    )


@app.post("/soap-note")
def soap_note_endpoint(payload: SoapNoteRequest):
    return generate_soap_note(
        transcription=payload.transcription,
        patient_data=payload.patient,
        consultation_reason=payload.consultation_reason,
        existing_notes=payload.existing_notes,
    )


@app.post("/extract-followup")
def extract_followup_endpoint(payload: ExtractFollowupRequest):
    return extract_followup_from_soap(payload.soap_note, payload.consultation_id)


@app.post("/send-reminder")
def send_reminder_endpoint(payload: SendReminderRequest):
    return send_whatsapp_reminder(
        payload.patient_phone, payload.patient_name, payload.doctor_name,
        payload.follow_up_date, payload.reason
    )
