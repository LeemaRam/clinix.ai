import requests
from pathlib import Path

path = Path('temp_transcribe_test.wav')
print('file exists', path.exists(), 'size', path.stat().st_size if path.exists() else 'missing')

with path.open('rb') as f:
    response = requests.post(
        'http://127.0.0.1:8000/transcribe',
        files={'file': ('temp_transcribe_test.wav', f, 'audio/wav')},
        data={'speech_language': 'en', 'consultation_id': 'test-001'},
    )

print('status', response.status_code)
try:
    print(response.json())
except Exception as exc:
    print('json_error', exc)
    print(response.text)
