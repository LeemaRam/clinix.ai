import json
import os
from openai import OpenAI


def _client() -> OpenAI:
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _has_openai_key() -> bool:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    return bool(key)


def transcribe_audio_file(file_path: str, speech_language: str = "en") -> dict:
    language = "ur" if str(speech_language).lower().startswith("ur") else "en"

    if not _has_openai_key():
        fallback_text = "Transcription unavailable: OPENAI_API_KEY is not configured."
        return {
            "language": language,
            "raw_text": fallback_text,
            "segments": [],
            "confidence_score": 0.0,
            "duration": 0.0,
            "analysis": {
                "summary": fallback_text,
                "medical_info": {"symptoms": [], "diagnoses": [], "medications": [], "recommendations": []},
            },
        }

    try:
        with open(file_path, "rb") as audio_file:
            transcript = _client().audio.transcriptions.create(
                model=os.getenv("OPENAI_TRANSCRIBE_MODEL", "whisper-1"),
                file=audio_file,
                language=language,
                response_format="verbose_json"
            )
    except Exception as exc:
        fallback_text = f"Transcription failed in AI provider: {exc}"
        return {
            "language": language,
            "raw_text": fallback_text,
            "segments": [],
            "confidence_score": 0.0,
            "duration": 0.0,
            "analysis": {
                "summary": fallback_text,
                "medical_info": {"symptoms": [], "diagnoses": [], "medications": [], "recommendations": []},
            },
        }

    segments = []
    for i, s in enumerate(getattr(transcript, "segments", []) or []):
        segments.append(
            {
                "id": i + 1,
                "start": float(getattr(s, "start", 0.0)),
                "end": float(getattr(s, "end", 0.0)),
                "text": str(getattr(s, "text", "")),
                "confidence": float(getattr(s, "avg_logprob", 0.0) or 0.0),
                "speaker": "unknown",
            }
        )

    raw_text = str(getattr(transcript, "text", "") or "")
    analysis = extract_medical_analysis(raw_text, language)

    return {
        "language": str(getattr(transcript, "language", language) or language),
        "raw_text": raw_text,
        "segments": segments,
        "confidence_score": 0.95 if raw_text else 0.0,
        "duration": float(getattr(transcript, "duration", 0.0) or 0.0),
        "analysis": analysis,
    }


def extract_medical_analysis(raw_text: str, language: str = "en") -> dict:
    if not _has_openai_key():
        return {
            "summary": raw_text,
            "medical_info": {"symptoms": [], "diagnoses": [], "medications": [], "recommendations": []},
        }

    prompt = (
        "Extract structured medical information from this consultation transcript. "
        "Return strict JSON with keys: summary, medical_info (symptoms, diagnoses, medications, recommendations)."
    )

    try:
        result = _client().chat.completions.create(
            model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": "You are a medical documentation assistant."},
                {"role": "user", "content": f"Language: {language}\n\n{prompt}\n\nTranscript:\n{raw_text}"},
            ],
            temperature=0.2,
        )
    except Exception:
        return {
            "summary": raw_text,
            "medical_info": {"symptoms": [], "diagnoses": [], "medications": [], "recommendations": []},
        }

    text = result.choices[0].message.content or ""

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    return {
        "summary": text,
        "medical_info": {"symptoms": [], "diagnoses": [], "medications": [], "recommendations": []},
    }


def generate_report(transcription_text: str, consultation_type: str = "general", language: str = "en") -> dict:
    if not _has_openai_key():
        return {
            "summary": transcription_text[:600],
            "recommendations": ["Configure OPENAI_API_KEY to enable AI-generated recommendations."],
            "raw_response": "fallback",
        }

    prompt = (
        "Generate a concise clinical report with: 1) summary paragraph, 2) bullet recommendations. "
        "Respond as JSON with keys summary and recommendations (array of strings)."
    )

    try:
        result = _client().chat.completions.create(
            model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": "You are a medical documentation assistant."},
                {
                    "role": "user",
                    "content": f"Language: {language}\nConsultation type: {consultation_type}\n\n{prompt}\n\nTranscript:\n{transcription_text}",
                },
            ],
            temperature=0.2,
        )
    except Exception as exc:
        return {
            "summary": transcription_text[:600],
            "recommendations": [f"AI provider unavailable: {exc}"],
            "raw_response": "fallback",
        }

    text = result.choices[0].message.content or ""

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return {
                "summary": parsed.get("summary", ""),
                "recommendations": parsed.get("recommendations", []),
                "raw_response": text,
            }
    except Exception:
        pass

    return {"summary": text, "recommendations": [], "raw_response": text}
