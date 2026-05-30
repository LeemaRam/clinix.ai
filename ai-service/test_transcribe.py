import wave
import struct
from pathlib import Path
import requests

file_path = Path('test_silence.wav')
with wave.open(str(file_path), 'wb') as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(16000)
    wf.writeframes(b''.join([struct.pack('<h', 0) for _ in range(16000)]))

print('created', file_path.exists())
with open(file_path, 'rb') as f:
    response = requests.post(
        'http://127.0.0.1:8000/transcribe',
        files={'file': ('test_silence.wav', f, 'audio/wav')},
        data={'speech_language': 'en', 'consultation_id': 'test-123'}
    )
    print('status', response.status_code)
    print('json', response.text)
