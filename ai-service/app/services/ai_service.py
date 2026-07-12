import json
import mimetypes
import os
import tempfile
import time

from openai import OpenAI


def get_audio_info(file_path: str) -> dict:
    stats = os.stat(file_path)
    mime_type, _ = mimetypes.guess_type(file_path)
    duration_seconds = None
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(file_path)
        duration_seconds = len(audio) / 1000.0
    except Exception as exc:
        print(f"[ai-service] Unable to read audio duration for {file_path}: {exc}")

    return {
        'size': stats.st_size,
        'mime_type': mime_type or 'application/octet-stream',
        'duration': duration_seconds,
        'exists': os.path.exists(file_path),
        'is_file': os.path.isfile(file_path)
    }


def get_response_text(response) -> str:
    if response is None:
        return ''

    if hasattr(response, 'output_text'):
        return str(response.output_text).strip()

    if hasattr(response, 'to_dict'):
        data = response.to_dict()
    else:
        try:
            data = dict(response)
        except Exception:
            data = {}

    if isinstance(data, dict):
        if data.get('output_text'):
            return str(data.get('output_text')).strip()

        output = data.get('output', [])
        if isinstance(output, list):
            text_parts = []
            for item in output:
                if isinstance(item, dict):
                    content = item.get('content', [])
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and isinstance(block.get('text'), str):
                                text_parts.append(block.get('text'))
                            elif isinstance(block, str):
                                text_parts.append(block)
                elif isinstance(item, str):
                    text_parts.append(item)
            return ' '.join([part.strip() for part in text_parts if part]).strip()

    return ''


def _extract_json(text: str):
    if not text or not isinstance(text, str):
        return None

    try:
        return json.loads(text)
    except Exception:
        start = text.find('{')
        end = text.rfind('}')
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            return None


def generate_json(prompt: str, fallback: dict) -> dict:
    openai_key = str(os.getenv('OPENAI_API_KEY', '')).strip()
    if not openai_key:
        return fallback

    client = OpenAI(api_key=openai_key)
    try:
        response = client.responses.create(
            model='gpt-4.1-mini',
            input=prompt,
            max_output_tokens=700,
            temperature=0.0
        )
        raw_output = get_response_text(response)
        parsed = _extract_json(raw_output)
        if isinstance(parsed, dict):
            return parsed
        return fallback
    except Exception as exc:
        print(f"[ai-service] OpenAI JSON generation failed: {exc}")
        return fallback


def generate_text(prompt: str, fallback: str = '') -> str:
    openai_key = str(os.getenv('OPENAI_API_KEY', '')).strip()
    if not openai_key:
        return fallback

    client = OpenAI(api_key=openai_key)
    try:
        response = client.responses.create(
            model='gpt-4.1-mini',
            input=prompt,
            max_output_tokens=800,
            temperature=0.2
        )
        raw_output = get_response_text(response)
        return raw_output or fallback
    except Exception as exc:
        print(f"[ai-service] OpenAI text generation failed: {exc}")
        return fallback


def transcribe_audio_file(file_path: str, speech_language: str = "en", consultation_id: str = "") -> dict:
    if not file_path:
        raise ValueError('Audio file path is required for transcription')

    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        raise FileNotFoundError(f'Audio file not found: {file_path}')

    speech_language = speech_language or 'en'
    language = 'ur' if str(speech_language).lower().startswith('ur') else 'en'
    audio_info = get_audio_info(file_path)

    print('[ai-service] transcription request started', {
        'consultation_id': consultation_id,
        'file_path': file_path,
        'file_size_bytes': audio_info['size'],
        'file_mime_type': audio_info['mime_type'],
        'decoded_duration_seconds': audio_info['duration'],
        'speech_language': speech_language,
    })

    openai_key = str(os.getenv('OPENAI_API_KEY', '')).strip()
    if not openai_key:
        raise RuntimeError('OPENAI_API_KEY is not configured for transcription')

    client = OpenAI(api_key=openai_key)
    converted_path = None
    audio_path = file_path
    extension = os.path.splitext(file_path)[1].lower()
    if extension not in {'.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg'}:
        converted_path = convert_to_mp3(file_path)
        audio_path = converted_path

    try:
        with open(audio_path, 'rb') as audio_file:
            print('[ai-service] whisper request started', {
                'consultation_id': consultation_id,
                'audio_path': audio_path,
                'audio_path_size_bytes': os.path.getsize(audio_path),
                'speech_language': speech_language,
            })

            whisper_start = time.monotonic()
            response = client.audio.transcriptions.create(
                model='whisper-1',
                file=audio_file,
                language=speech_language
            )
            whisper_duration = time.monotonic() - whisper_start

        if isinstance(response, dict):
            response_data = response
        elif hasattr(response, 'to_dict'):
            response_data = response.to_dict()
        else:
            response_data = dict(response)

        transcript = str(response_data.get('text', '') or response_data.get('transcript', '')).strip()
        response_segments = response_data.get('segments', []) or []
        segments = []
        for index, segment in enumerate(response_segments):
            segments.append({
                'id': index + 1,
                'start': float(segment.get('start', 0.0)),
                'end': float(segment.get('end', 0.0)),
                'text': str(segment.get('text', '')).strip(),
                'speaker': 'unknown'
            })

        duration = response_data.get('duration') or audio_info['duration'] or (segments[-1]['end'] if segments else 0)
        confidence_score = float(response_data.get('confidence', 0.0) or 0.0)

        print('[ai-service] whisper transcription completed', {
            'consultation_id': consultation_id,
            'transcript_length': len(transcript),
            'transcription_duration_seconds': whisper_duration,
            'duration': duration,
            'segment_count': len(segments),
        })

        analysis = extract_medical_analysis(transcript, language)
        return {
            'language': language,
            'raw_text': transcript,
            'segments': segments,
            'confidence_score': confidence_score,
            'duration': duration,
            'analysis': analysis,
        }
    except Exception as exc:
        print(f"[ai-service] Whisper transcription failed consultation_id={consultation_id}: {exc}")
        raise
    finally:
        if converted_path and os.path.exists(converted_path):
            try:
                os.remove(converted_path)
            except OSError:
                pass


def extract_medical_analysis(raw_text: str, language: str = "en") -> dict:
    fallback = {
        "subjective": raw_text[:500],
        "objective": None,
        "assessment": None,
        "plan": None,
        "medications_mentioned": [],
        "lifestyle_recommendations": None,
        "dietary_recommendations": None,
        "self_care_measures": None,
        "neurological_examination": None,
        "vital_signs": None,
        "follow_up": None,
        "follow_up_days": None,
        "confidence": None,
    }

    prompt = f"""
You are a clinical documentation assistant.
Return STRICT JSON only (no markdown) with keys:
subjective, objective, assessment, plan, medications_mentioned, lifestyle_recommendations,
dietary_recommendations, self_care_measures, neurological_examination, vital_signs,
follow_up, follow_up_days, confidence.
Language: {language}
Transcript:
{raw_text}

Guidelines:
- Use only JSON, no markdown, no commentary.
- If a section is not mentioned, set it to null.
- Do not invent normal vital signs values; use null if none were documented.
- For follow_up, return a concise instruction or null.
- For medications_mentioned, return an array of medication names or an empty array.
- For lifestyle_recommendations, dietary_recommendations, self_care_measures, and neurological_examination,
  return null if no relevant information was discussed.
- For vital_signs, return null unless actual values were documented.
""".strip()

    candidate = generate_json(prompt, fallback)
    return {
        "subjective": str(candidate.get("subjective") or fallback["subjective"]),
        "objective": candidate.get("objective") if candidate.get("objective") is not None else fallback["objective"],
        "assessment": candidate.get("assessment") if candidate.get("assessment") is not None else fallback["assessment"],
        "plan": candidate.get("plan") if candidate.get("plan") is not None else fallback["plan"],
        "medications_mentioned": (
            [str(x) for x in candidate.get("medications_mentioned", [])]
            if isinstance(candidate.get("medications_mentioned", []), list)
            else []
        ),
        "lifestyle_recommendations": (
            str(candidate.get("lifestyle_recommendations")).strip()
            if candidate.get("lifestyle_recommendations") is not None else None
        ),
        "dietary_recommendations": (
            str(candidate.get("dietary_recommendations")).strip()
            if candidate.get("dietary_recommendations") is not None else None
        ),
        "self_care_measures": (
            str(candidate.get("self_care_measures")).strip()
            if candidate.get("self_care_measures") is not None else None
        ),
        "neurological_examination": (
            str(candidate.get("neurological_examination")).strip()
            if candidate.get("neurological_examination") is not None else None
        ),
        "vital_signs": (
            str(candidate.get("vital_signs")).strip()
            if candidate.get("vital_signs") is not None else None
        ),
        "follow_up": (
            str(candidate.get("follow_up")).strip()
            if candidate.get("follow_up") is not None else None
        ),
        "follow_up_days": int(candidate.get("follow_up_days", 7) or 7),
        "confidence": (
            str(candidate.get("confidence"))
            if candidate.get("confidence") is not None else fallback["confidence"]
        ),
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
        "raw_response": "openai" if os.getenv('OPENAI_API_KEY') else "fallback",
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
