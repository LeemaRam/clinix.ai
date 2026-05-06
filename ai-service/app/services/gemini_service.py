import json
import os
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest


GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-1.5-flash')


def has_gemini_key() -> bool:
    return bool(str(os.getenv('GEMINI_API_KEY', '')).strip())


def _extract_json(text: str):
    if not text:
        return None

    try:
        return json.loads(text)
    except Exception:
        start = text.find('{')
        end = text.rfind('}')
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None


def generate_json(prompt: str, fallback: dict) -> dict:
    key = str(os.getenv('GEMINI_API_KEY', '')).strip()
    if not key:
        return fallback

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        f"?key={urlparse.quote(key)}"
    )

    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.2,
            'responseMimeType': 'application/json'
        }
    }

    try:
        req = urlrequest.Request(
            endpoint,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        with urlrequest.urlopen(req, timeout=45) as response:
            body = response.read().decode('utf-8')

        data = json.loads(body)
        text = (
            data.get('candidates', [{}])[0]
            .get('content', {})
            .get('parts', [{}])[0]
            .get('text', '')
        )
        parsed = _extract_json(text)
        if isinstance(parsed, dict):
            return parsed
        return fallback
    except (urlerror.URLError, TimeoutError, ValueError, KeyError, IndexError):
        return fallback


def generate_text(prompt: str, fallback: str = '') -> str:
    key = str(os.getenv('GEMINI_API_KEY', '')).strip()
    if not key:
        return fallback

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
        f"?key={urlparse.quote(key)}"
    )

    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.2,
            'maxOutputTokens': 800,
            'responseMimeType': 'text/plain'
        }
    }

    try:
        req = urlrequest.Request(
            endpoint,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        with urlrequest.urlopen(req, timeout=45) as response:
            body = response.read().decode('utf-8')

        return body.strip() or fallback
    except (urlerror.URLError, TimeoutError, ValueError):
        return fallback
