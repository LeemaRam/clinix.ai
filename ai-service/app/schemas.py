from pydantic import BaseModel
from typing import List, Dict, Any


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
