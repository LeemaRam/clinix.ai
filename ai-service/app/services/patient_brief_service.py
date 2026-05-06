from datetime import datetime
from typing import Dict, List

from .gemini_service import generate_text


def generate_patient_brief(
    patient: Dict,
    consultations: List[Dict] = None,
    reports: List[Dict] = None,
    followups: List[Dict] = None,
    patient_files: List[Dict] = None
) -> Dict:
    """
    Agent 3: Generate professional Patient Brief History with file integration
    """
    consultations = consultations or []
    reports = reports or []
    followups = followups or []
    patient_files = patient_files or []

    context = f"""
Patient Profile:
- Name: {patient.get('name')}
- Age: {patient.get('age', 'N/A')}
- Gender: {patient.get('gender', 'N/A')}
- Blood Group: {patient.get('bloodGroup', 'N/A')}
- Allergies: {patient.get('allergies') or 'None reported'}
- Chronic Conditions: {patient.get('chronicConditions') or 'None'}
"""

    if consultations:
        context += "\nRecent Consultations:\n"
        for cons in consultations[-5:]:
            date = str(cons.get('createdAt', 'N/A'))[:10]
            context += f"- {date}: {cons.get('reason', 'Consultation')} → Diagnosis: {cons.get('diagnosis', 'N/A')}\n"

    if reports:
        context += "\nRecent Reports:\n"
        for report in reports[-3:]:
            context += f"- {report.get('title', 'Report')}: {report.get('summary', '')[:150]}...\n"

    if patient_files:
        context += "\nPatient Uploaded Medical Files:\n"
        for file in patient_files[-5:]:
            file_desc = file.get('summary') or file.get('text', '')[:250] or 'No readable text available.'
            context += (
                f"- {file.get('originalName', 'File')} ({file.get('mimeType', 'document')}, uploaded: {file.get('uploadedAt', 'N/A')}): "
                f"{file_desc[:250].replace('\n', ' ')}\n"
            )

    prompt = f"""
You are a senior medical assistant creating a Patient Brief for a busy doctor.

{context}

Create a clear, professional, and actionable brief with these sections:

1. Patient Summary
2. Key Medical History
3. Active Issues & Red Flags
4. Doctor Focus Points (what to ask/examine)
5. Recommendations

Rules:
- Keep total length under 450 words
- Use clinical but readable language
- Highlight anything urgent
- Be objective and factual
- Use markdown formatting
"""

    try:
        brief_text = generate_text(prompt, fallback="No patient brief could be generated at this time.")

        return {
            "success": True,
            "patientId": str(patient.get('_id')),
            "brief": brief_text,
            "generatedAt": datetime.utcnow().isoformat(),
            "dataSources": {
                "consultations": len(consultations),
                "reports": len(reports),
                "followups": len(followups)
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to generate patient brief using AI"
        }