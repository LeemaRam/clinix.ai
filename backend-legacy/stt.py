import os
from openai import OpenAI
from dotenv import load_dotenv
import mimetypes
from pydub import AudioSegment
import tempfile
import json
from typing import Optional, Dict, Any

# Load environment variables
load_dotenv()

def convert_to_mp3(input_file):
    """
    Convert audio file to MP3 format
    """
    try:
        # Load the audio file
        audio = AudioSegment.from_file(input_file)
        
        # Create a temporary file with .mp3 extension
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, "temp_audio.mp3")
        
        # Export as MP3
        audio.export(temp_path, format="mp3")
        
        return temp_path
    except Exception as e:
        print(f"Error converting audio: {str(e)}")
        return None

def get_file_info(file_path):
    """
    Get detailed information about the file
    """
    file_stats = os.stat(file_path)
    mime_type, _ = mimetypes.guess_type(file_path)
    return {
        'size': file_stats.st_size,
        'mime_type': mime_type,
        'exists': os.path.exists(file_path),
        'is_file': os.path.isfile(file_path)
    }

def transcribe_audio(audio_file_path, language: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Transcribe an audio file using OpenAI's Whisper model.
    
    Args:
        audio_file_path (str): Path to the audio file to transcribe
        
    Returns:
        Optional[Dict[str, Any]]: A structured dictionary containing:
            - duration: Total duration of the audio in seconds
            - language: Detected language of the audio
            - full_text: Complete transcribed text
            - segments: List of segments with timestamps and text
            - status: Transcription status ('success' or 'error')
            - error: Error message if status is 'error'
    """
    try:
        # Get file information
        # audio_file_path = 'Audios Casos Clínicos/¿Qué se debe y qué no se debe hacer en consulta médica_.wav'  # Using the renamed audio file
        file_info = get_file_info(audio_file_path)
        print(f"\nFile information:")
        print(f"File exists: {file_info['exists']}")
        print(f"Is file: {file_info['is_file']}")
        print(f"File size: {file_info['size']} bytes")
        print(f"MIME type: {file_info['mime_type']}")
        
        if not file_info['exists'] or not file_info['is_file']:
            return {
                'status': 'error',
                'error': f"File {audio_file_path} not found or is not a file"
            }
        
        # Convert to MP3
        print("\nConverting audio to MP3 format...")
        mp3_path = convert_to_mp3(audio_file_path)
        
        if not mp3_path:
            return {
                'status': 'error',
                'error': "Failed to convert audio to MP3 format"
            }
            
        # Initialize OpenAI client
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return {
                'status': 'error',
                'error': "OPENAI_API_KEY not found in environment variables"
            }
        
        if not api_key.startswith('sk-'):
            return {
                'status': 'error',
                'error': "Invalid OPENAI_API_KEY format. Key should start with 'sk-'"
            }
            
        client = OpenAI(api_key=api_key)
        
        print("\nAttempting to transcribe the converted file...")
        
        # Open and read the converted MP3 file
        with open(mp3_path, "rb") as audio_file:
            # Call OpenAI's transcription API
            print("Calling OpenAI API...")
            transcription_kwargs = {
                "model": "whisper-1",
                "file": audio_file,
                "response_format": "verbose_json",
            }
            if language:
                transcription_kwargs["language"] = language

            response = client.audio.transcriptions.create(**transcription_kwargs)
        
        # Clean up temporary file
        if os.path.exists(mp3_path):
            os.remove(mp3_path)
            
        # Structure the response
        structured_result = {
            'status': 'success',
            'duration': response.duration,
            'language': response.language,
            'full_text': response.text,
            'segments': [
                {
                    'id': segment.id,
                    'start': segment.start,
                    'end': segment.end,
                    'text': segment.text,
                    'confidence': segment.avg_logprob,
                    'no_speech_prob': segment.no_speech_prob
                }
                for segment in response.segments
            ]
        }
            
        return structured_result
        
    except Exception as e:
        error_message = str(e)
        if hasattr(e, 'response'):
            error_message += f"\nResponse status: {e.response.status_code}"
            error_message += f"\nResponse body: {e.response.text}"
        
        return {
            'status': 'error',
            'error': error_message
        }

def display_transcription_result(result: Dict[str, Any]) -> None:
    """
    Display the transcription result in a formatted way
    
    Args:
        result (Dict[str, Any]): The transcription result in verbose JSON format
    """
    print("\nTranscription Result:")
    print("-" * 50)
    print(f"Duration: {result.get('duration', 'N/A')} seconds")
    print(f"Language: {result.get('language', 'N/A')}")
    print(f"Text: {result.get('text', 'N/A')}")
    
    # Display segments if available
    segments = result.get('segments', [])
    if segments:
        print("\nSegments:")
        print("-" * 50)
        for segment in segments:
            print(f"\nSegment {segment.get('id', 'N/A')}:")
            print(f"Start: {segment.get('start', 'N/A')}s")
            print(f"End: {segment.get('end', 'N/A')}s")
            print(f"Text: {segment.get('text', 'N/A')}")
            print(f"Confidence: {segment.get('avg_logprob', 'N/A')}")
            print(f"No Speech Probability: {segment.get('no_speech_prob', 'N/A')}")

def test_transcription():
    """
    Test function to demonstrate audio transcription
    """
    # Example usage
    test_file = "medic_consult.m4a"  # Using the renamed audio file
    
    print(f"\nStarting transcription test...")
    print(f"Working directory: {os.getcwd()}")
    print(f"Target file: {test_file}")
    
    if os.path.exists(test_file):
        print(f"Transcribing {test_file}...")
        result = transcribe_audio(test_file)
        
        if result['status'] == 'success':
            display_transcription_result(result)
        else:
            print(f"Transcription error: {result['error']}")
    else:
        print(f"Test file {test_file} not found.")

if __name__ == "__main__":
    test_transcription()
