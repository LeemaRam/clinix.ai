import json
import os
from openai import OpenAI


def _client() -> OpenAI:
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def transcribe_audio_file(file_path: str, speech_language: str = "en") -> dict:
    language = "ur" if str(speech_language).lower().startswith("ur") else "en"

    with open(file_path, "rb") as audio_file:
        transcript = _client().audio.transcriptions.create(
            model=os.getenv("OPENAI_TRANSCRIBE_MODEL", "whisper-1"),
            file=audio_file,
            language=language,
            response_format="verbose_json"
        )

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
    prompt = (
        "Extract structured medical information from this consultation transcript. "
        "Return strict JSON with keys: summary, medical_info (symptoms, diagnoses, medications, recommendations)."
    )

    result = _client().chat.completions.create(
        model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": "You are a medical documentation assistant."},
            {"role": "user", "content": f"Language: {language}\n\n{prompt}\n\nTranscript:\n{raw_text}"},
        ],
        temperature=0.2,
    )

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
    prompt = (
        "Generate a concise clinical report with: 1) summary paragraph, 2) bullet recommendations. "
        "Respond as JSON with keys summary and recommendations (array of strings)."
    )

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
