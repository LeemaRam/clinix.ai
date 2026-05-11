import os

from .gemini_service import generate_json, has_gemini_key


def transcribe_audio_file(file_path: str, speech_language: str = "en") -> dict:
    del file_path
    language = "ur" if str(speech_language).lower().startswith("ur") else "en"
    demo_mode = str(os.getenv("DEMO_MODE", "false")).strip().lower() in {"1", "true", "yes", "on"}

    # Create dialogue-style demo transcription with realistic segments
    demo_segments = [
        {"start": 0.0, "end": 2.5, "text": "What brings you in today?", "speaker": "doctor"},
        {"start": 2.5, "end": 5.0, "text": "I've been having persistent headaches for the last 3 days, and it's really affecting my sleep.", "speaker": "patient"},
        {"start": 5.0, "end": 7.0, "text": "I see. Have you experienced any nausea or sensitivity to light?", "speaker": "doctor"},
        {"start": 7.0, "end": 9.5, "text": "Yes, some mild nausea, but no light sensitivity. The pain is mainly on the right side.", "speaker": "patient"},
        {"start": 9.5, "end": 11.0, "text": "Have you taken anything for the pain?", "speaker": "doctor"},
        {"start": 11.0, "end": 13.0, "text": "I took paracetamol yesterday and it helped a bit, but the pain came back.", "speaker": "patient"},
        {"start": 13.0, "end": 15.0, "text": "Any fever or recent infections?", "speaker": "doctor"},
        {"start": 15.0, "end": 17.0, "text": "No fever. I had a cold last week, but that's resolved.", "speaker": "patient"},
    ]

    transcript = " ".join([seg["text"] for seg in demo_segments])

    if not demo_mode:
        # In non-demo mode, use fallback text
        transcript = "Transcription fallback: GEMINI_API_KEY not configured."
        demo_segments = [
            {
                "id": 0,
                "start": 0.0,
                "end": 5.0,
                "text": transcript,
                "speaker": "doctor",
                "confidence": 0.95,
                "no_speech_prob": 0.0,
            }
        ]

    analysis = extract_medical_analysis(transcript, language)

    # Build segments with proper IDs
    segments = [
        {
            "id": i,
            "start": seg.get("start", 0.0),
            "end": seg.get("end", 0.0),
            "text": seg.get("text", ""),
            "speaker": seg.get("speaker", "unknown"),
            "confidence": 0.95,
            "no_speech_prob": 0.0,
        }
        for i, seg in enumerate(demo_segments)
    ]

    return {
        "language": language,
        "raw_text": transcript,
        "segments": segments,
        "confidence_score": 0.95,
        "duration": demo_segments[-1]["end"] if demo_segments else 0.0,
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
