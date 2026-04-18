# ai-service/app/services/patient_brief_service.py
import json, os
from openai import OpenAI

def generate_patient_brief(patient: dict, recent_consultations: list) -> dict:
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
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
    try:
        res = client.chat.completions.create(
            model=os.getenv('OPENAI_CHAT_MODEL','gpt-4o-mini'),
            messages=[
                {'role':'system','content':'You are a clinical AI assistant.'},
                {'role':'user','content': prompt}
            ], temperature=0.2
        )
        return json.loads(res.choices[0].message.content)
    except Exception as e:
        return {'brief': 'Could not generate brief.', 'key_flags': [], 'error': str(e)}