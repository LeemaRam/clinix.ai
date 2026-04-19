# ai-service/app/services/patient_brief_service.py
import json

from .gemini_service import generate_json

def generate_patient_brief(patient: dict, recent_consultations: list) -> dict:
    summaries = [
        { 'summary': c.get('summary',''), 'medications': c.get('medications',[]),
          'diagnoses': c.get('diagnoses',[]) }
        for c in recent_consultations[:5]
    ]
    prompt = f'''
Patient: {patient['name']}, DOB: {patient['age']}
Allergies: {', '.join(patient.get('allergies', []))}
Current medications: {', '.join(patient.get('currentMedications', []))}
Conditions: {', '.join(patient.get('medicalConditions', []))}

Recent visits: {json.dumps(summaries)}

Write a 3-sentence clinical brief for this patient.
Return JSON: {{ 'brief': '...', 'key_flags': ['flag1','flag2'] }}
'''
    fallback = {'brief': 'Could not generate brief.', 'key_flags': []}
    result = generate_json(prompt, fallback)
    if not isinstance(result, dict):
        return fallback

    key_flags = result.get('key_flags', [])
    return {
        'brief': str(result.get('brief', fallback['brief'])),
        'key_flags': [str(item) for item in key_flags] if isinstance(key_flags, list) else []
    }