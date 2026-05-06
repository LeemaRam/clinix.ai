import os

from .gemini_service import generate_json, has_gemini_key


def transcribe_audio_file(file_path: str, speech_language: str = "en") -> dict:
    del file_path
    language = "ur" if str(speech_language).lower().startswith("ur") else "en"
    demo_mode = str(os.getenv("DEMO_MODE", "false")).strip().lower() in {"1", "true", "yes", "on"}

    transcript = (
        "Demo transcription: Patient reports persistent headache for 3 days, mild nausea, "
        "and partial relief after paracetamol. No fever or breathing difficulty reported. "
        "Follow-up advised in 7 days."
    )

    if not has_gemini_key() and not demo_mode:
        transcript = "Transcription fallback: GEMINI_API_KEY not configured."

    analysis = extract_medical_analysis(transcript, language)

    return {
        "language": language,
        "raw_text": transcript,
        "segments": [
            {
                "id": 1,
                "start": 0.0,
                "end": 5.0,
                "text": transcript,
                "confidence": 0.95,
                "speaker": "unknown",
            }
        ],
        "confidence_score": 0.95,
        "duration": 5.0,
        "analysis": analysis,
    }


def extract_medical_analysis(raw_text: str, language: str = "en") -> dict:
    fallback = {
        "subjective": raw_text[:500],
        "objective": "No objective findings documented.",
        "assessment": "Clinical assessment requires manual review.",
        "plan": "Symptomatic care and follow-up in 7 days.",
        "medications_mentioned": [],
        "follow_up_days": 7,
        "confidence": "low",
    }

    prompt = f"""
You are a clinical documentation assistant.
Return STRICT JSON only (no markdown) with keys:
subjective, objective, assessment, plan, medications_mentioned, follow_up_days, confidence.
Language: {language}
Transcript:
{raw_text}
""".strip()

    candidate = generate_json(prompt, fallback)
    return {
        "subjective": str(candidate.get("subjective", fallback["subjective"])),
        "objective": str(candidate.get("objective", fallback["objective"])),
        "assessment": str(candidate.get("assessment", fallback["assessment"])),
        "plan": str(candidate.get("plan", fallback["plan"])),
        "medications_mentioned": (
            [str(x) for x in candidate.get("medications_mentioned", [])]
            if isinstance(candidate.get("medications_mentioned", []), list)
            else []
        ),
        "follow_up_days": int(candidate.get("follow_up_days", 7) or 7),
        "confidence": str(candidate.get("confidence", fallback["confidence"])),
    }


def generate_report(transcription_text: str, consultation_type: str = "general", language: str = "en") -> dict:
    fallback = {
        "summary": transcription_text[:600],
        "recommendations": ["Manual review recommended."],
        "raw_response": "fallback",
    }

    prompt = f"""
You are a medical documentation assistant.
Create a concise clinical report summary and recommendations.
Return STRICT JSON with keys: summary (string), recommendations (array of strings).
Language: {language}
Consultation type: {consultation_type}
Transcript:
{transcription_text}
""".strip()

    parsed = generate_json(prompt, fallback)
    recommendations = parsed.get("recommendations", [])
    return {
        "summary": str(parsed.get("summary", fallback["summary"])),
        "recommendations": [str(x) for x in recommendations] if isinstance(recommendations, list) else [],
        "raw_response": "gemini" if has_gemini_key() else "fallback",
    }


def check_drug_safety(medications: list, patient_info: dict = None, patient_files: list = None, language: str = "en") -> dict:
    if not medications:
        return {
            "warnings": [],
            "interactions": [],
            "recommendations": [],
        }

    patient_info = patient_info or {}
    patient_files = patient_files or []
    fallback = {
        "warnings": ["Manual drug safety review recommended."],
        "interactions": [],
        "recommendations": ["Verify contraindications before prescribing."],
    }

    file_context = ''
    if patient_files:
        file_context = '\nPatient files:\n' + '\n'.join(
            [f"- {file.get('originalName', 'file')} ({file.get('mimeType', 'unknown')}): {file.get('summary', file.get('text', '')[:150])}" for file in patient_files]
        )

    prompt = f"""
You are a pharmaceutical safety assistant.
Return STRICT JSON with keys: warnings (array), interactions (array), recommendations (array).
Language: {language}
Medications: {', '.join([str(m) for m in medications])}
Patient info: {patient_info}
{file_context}
""".strip()

    parsed = generate_json(prompt, fallback)
    return {
        "warnings": [str(x) for x in parsed.get("warnings", [])] if isinstance(parsed.get("warnings", []), list) else [],
        "interactions": parsed.get("interactions", []) if isinstance(parsed.get("interactions", []), list) else [],
        "recommendations": [str(x) for x in parsed.get("recommendations", [])] if isinstance(parsed.get("recommendations", []), list) else [],
    }
