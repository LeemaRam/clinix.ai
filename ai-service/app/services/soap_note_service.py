from datetime import datetime
from typing import Dict, Optional

from .gemini_service import generate_text


def generate_soap_note(
    transcription: str,
    patient_data: Dict,
    consultation_reason: Optional[str] = None,
    existing_notes: Optional[str] = None,
) -> Dict:
    """Generate a clinical SOAP note for the given patient and transcription."""
    patient_name = patient_data.get('name') or patient_data.get('first_name') or 'Unknown patient'
    patient_age = patient_data.get('age') or patient_data.get('date_of_birth') or 'Unknown age'
    patient_gender = patient_data.get('gender', 'Unknown gender')

    context = f"""
Patient: {patient_name}, {patient_age} years old, {patient_gender}
Chief Complaint: {consultation_reason or 'Not provided'}
""".strip()

    if existing_notes:
        context += f"\nPrevious Notes: {existing_notes[:500]}...\n"

    prompt = f"""
You are a senior physician creating a high-quality SOAP Note for clinical records.

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
            raise ValueError('Empty SOAP note from Gemini')

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
