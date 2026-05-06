from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class GenerateReportRequest(BaseModel):
    transcription_text: str
    consultation_type: str = "general"
    language: str = "en"


class Segment(BaseModel):
    id: int
    start: float
    end: float
    text: str
    confidence: float = 0.0
    speaker: str = "unknown"


class TranscribeResponse(BaseModel):
    language: str
    raw_text: str
    segments: List[Dict[str, Any]]
    confidence_score: float
    duration: float
    analysis: Dict[str, Any]


class GenerateReportResponse(BaseModel):
    summary: str
    recommendations: List[str]
    raw_response: str


class DrugSafetyRequest(BaseModel):
    medications: List[str]
    patient_info: Dict[str, Any] = {}
    patient_files: List[Dict[str, Any]] = []
    language: str = "en"


class DrugSafetyResponse(BaseModel):
    warnings: List[str]
    interactions: List[Dict[str, Any]]
    recommendations: List[str]


class DrugCheckRequest(BaseModel):
    new_drugs: List[str]
    existing_drugs: List[str]


class PatientBriefRequest(BaseModel):
    patient: Dict[str, Any]
    recentConsultations: List[Dict[str, Any]]
    reports: List[Dict[str, Any]] = []
    patient_files: List[Dict[str, Any]] = []


class SoapNoteRequest(BaseModel):
    transcription: str
    patient: Dict[str, Any]
    consultation_reason: Optional[str] = None
    existing_notes: Optional[str] = None


class ExtractFollowupRequest(BaseModel):
    soap_note: Dict[str, Any]
    consultation_id: str


class SendReminderRequest(BaseModel):
    patient_phone: str
    patient_name: str
    doctor_name: str
    follow_up_date: str
    reason: str
