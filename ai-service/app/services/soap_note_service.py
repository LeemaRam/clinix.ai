from datetime import datetime
from typing import Dict, Optional
import re

from .ai_service import generate_text


def _format_patient_age(patient_data: Dict) -> str:
    age_value = patient_data.get('age') or patient_data.get('age_years')
    if age_value:
        try:
            return str(int(age_value))
        except (ValueError, TypeError):
            pass

    date_of_birth = patient_data.get('date_of_birth') or patient_data.get('dob')
    if date_of_birth:
        try:
            dob = datetime.fromisoformat(str(date_of_birth))
            today = datetime.utcnow()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            return str(age)
        except Exception:
            pass

    return 'Unknown age'


def _warn_transcript_age_mismatch(patient_age: str, transcript: str) -> None:
    if not patient_age or patient_age == 'Unknown age' or not transcript:
        return

    match = re.search(r"\b(\d{1,3})\s*-?year[- ]old\b", transcript, re.IGNORECASE)
    if match:
        transcript_age = match.group(1)
        if transcript_age != patient_age:
            print(
                f"[ai-service] Patient age mismatch: profile age={patient_age}, transcript age={transcript_age}. "
                "Using profile age for SOAP note and medical documentation."
            )


def generate_soap_note(
    transcription: str,
    patient_data: Dict,
    consultation_reason: Optional[str] = None,
    existing_notes: Optional[str] = None,
) -> Dict:
    """Generate a clinical SOAP note for the given patient and transcription."""
    patient_name = patient_data.get('name') or patient_data.get('first_name') or 'Unknown patient'
    patient_age = _format_patient_age(patient_data)
    patient_gender = patient_data.get('gender') or 'Unknown gender'

    _warn_transcript_age_mismatch(patient_age, transcription)

    context = f"""
Patient: {patient_name}
Age: {patient_age}
Gender: {patient_gender}
Chief Complaint: {consultation_reason or 'Not provided'}
""".strip()

    if existing_notes:
        context += f"\nPrevious Notes: {existing_notes[:500]}...\n"

    prompt = f"""
You are a senior physician creating a high-quality SOAP Note for clinical records.

Use the patient profile below as the source of truth:
- Name: {patient_name}
- Age: {patient_age}
- Gender: {patient_gender}

If the transcription contains any age or gender details, ignore them and do not override the patient profile values.

{context}

Transcription:
{transcription}

Create a professional SOAP note with this exact structure:

Subjective: (History of present illness, symptoms, patient quotes)
Objective: (Examination findings, vitals if mentioned, observable data)
Assessment: (Diagnosis, differential diagnosis, clinical reasoning)
Plan: (Medications, investigations, lifestyle advice, follow-up plan)

Additional Requirements:
- Include 2-5 relevant ICD-10 codes at the end
- Highlight any red flags or urgent actions
- Use clear, concise, clinically appropriate language
- Maintain medical accuracy and professionalism
""".strip()

    try:
        soap_text = generate_text(prompt, fallback='')
        if not soap_text:
            raise ValueError('Empty SOAP note from OpenAI')

        return {
            'success': True,
            'soapNote': soap_text.strip(),
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'patientId': str(patient_data.get('_id') or patient_data.get('id') or ''),
            'transcriptionLength': len(transcription or ''),
        }
    except Exception as exc:
        return {
            'success': False,
            'error': str(exc),
            'message': 'Failed to generate SOAP note',
        }
