from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_socketio import SocketIO, emit, join_room
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import pymongo
from pymongo import MongoClient
from bson import ObjectId
import os
import json
from datetime import datetime, timedelta
import uuid
import openai
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import io
import base64
from dotenv import load_dotenv
from stt import transcribe_audio, get_file_info
from openai import OpenAI
import re
import stripe
from functools import wraps
import librosa
import soundfile as sf
import numpy as np
from pydub import AudioSegment
import tempfile
import shutil

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=7)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB for large audio files
app.config['UPLOAD_FOLDER'] = 'uploads'

# Initialize extensions
CORS(app, max_age=3600)
jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=500 * 1024 * 1024)

# MongoDB connection
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/clinix_ai')
client = MongoClient(MONGODB_URI)
db = client.clinix_ai

# OpenAI configuration
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Create upload directories
os.makedirs('uploads/audio', exist_ok=True)
os.makedirs('uploads/reports', exist_ok=True)
os.makedirs('uploads/temp', exist_ok=True)

# Clean up old temporary files on startup
def cleanup_temp_files():
    """Clean up old temporary files on startup"""
    try:
        temp_dir = 'uploads/temp'
        if os.path.exists(temp_dir):
            current_time = datetime.utcnow()
            for item in os.listdir(temp_dir):
                item_path = os.path.join(temp_dir, item)
                try:
                    # Remove items older than 1 hour
                    if os.path.getctime(item_path) < (current_time - timedelta(hours=1)).timestamp():
                        if os.path.isfile(item_path):
                            os.remove(item_path)
                        elif os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                        print(f"Cleaned up old temp file: {item_path}")
                except Exception as e:
                    print(f"Error cleaning up temp file {item_path}: {e}")
        
        # Also clean up expired report previews
        cleanup_expired_previews()
        cleanup_expired_trials()
    except Exception as e:
        print(f"Error during temp cleanup: {e}")

def cleanup_expired_previews():
    """Clean up expired report previews from database"""
    try:
        current_time = datetime.utcnow()
        result = db.report_previews.delete_many({
            'expires_at': {'$lt': current_time}
        })
        if result.deleted_count > 0:
            print(f"Cleaned up {result.deleted_count} expired report previews")
    except Exception as e:
        print(f"Error cleaning up expired previews: {str(e)}")

def cleanup_expired_trials():
    """Clean up expired trial subscriptions"""
    try:
        current_time = datetime.utcnow()
        
        # Find expired trial subscriptions
        expired_trials = db.user_subscriptions.find({
            'status': 'trialing',
            'currentPeriodEnd': {'$lt': current_time}
        })
        
        expired_count = 0
        for trial in expired_trials:
            try:
                # Update subscription status to expired
                db.user_subscriptions.update_one(
                    {'_id': trial['_id']},
                    {'$set': {
                        'status': 'expired',
                        'updated_at': current_time
                    }}
                )
                
                # Update user to remove subscription reference
                db.users.update_one(
                    {'_id': ObjectId(trial['userId'])},
                    {'$set': {
                        'subscription_plan_id': None,
                        'updated_at': current_time
                    }}
                )
                
                expired_count += 1
                print(f"Expired trial subscription for user {trial['userId']}")
                
            except Exception as e:
                print(f"Error expiring trial {trial['_id']}: {e}")
                continue
        
        if expired_count > 0:
            print(f"Cleaned up {expired_count} expired trial subscriptions")
            
    except Exception as e:
        print(f"Error during trial cleanup: {str(e)}")

# Run cleanup on startup
cleanup_temp_files()

# Audio processing constants
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB limit for OpenAI Whisper
CHUNK_DURATION_SECONDS = 600  # 10 minutes per chunk (well under 25MB limit)
OVERLAP_SECONDS = 2  # 2 seconds overlap between chunks to maintain context

# Supported audio formats for chunking
SUPPORTED_CHUNK_FORMATS = ['mp3', 'wav']
FALLBACK_FORMAT = 'wav'

# Utility functions
def serialize_doc(doc):
    """Convert MongoDB document to JSON serializable format"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == '_id':
                result['id'] = str(value)
            elif isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, (dict, list)):
                result[key] = serialize_doc(value)
            else:
                result[key] = value
        return result
    return doc

def allowed_file(filename):
    """Check if file extension is allowed"""
    ALLOWED_EXTENSIONS = {'wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def calculate_age(birth_date):
    """Calculate age from birth date"""
    if isinstance(birth_date, str):
        birth_date = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
    today = datetime.now()
    age = today.year - birth_date.year
    if today.month < birth_date.month or (today.month == birth_date.month and today.day < birth_date.day):
        age -= 1
    return age

# Audio processing functions
def check_ffmpeg_capabilities():
    """
    Check what audio formats FFmpeg supports
    """
    try:
        import subprocess
        result = subprocess.run(['ffmpeg', '-formats'], capture_output=True, text=True)
        if result.returncode == 0:
            output = result.stdout.lower()
            supported_formats = []
            if 'mp3' in output:
                supported_formats.append('mp3')
            if 'wav' in output:
                supported_formats.append('wav')
            if 'm4a' in output:
                supported_formats.append('m4a')
            if 'flac' in output:
                supported_formats.append('flac')
            print(f"FFmpeg supported formats: {supported_formats}")
            return supported_formats
        else:
            print(f"FFmpeg check failed: {result.stderr}")
            return ['wav']  # Default fallback
    except Exception as e:
        print(f"Error checking FFmpeg capabilities: {e}")
        return ['wav']  # Default fallback

def convert_audio_to_compatible_format(audio_segment, output_path, preferred_format='mp3'):
    """
    Convert audio segment to a compatible format with fallback options
    """
    # Get supported formats from FFmpeg
    supported_formats = check_ffmpeg_capabilities()
    
    # Prioritize formats based on FFmpeg support
    if preferred_format in supported_formats:
        formats_to_try = [preferred_format]
    else:
        formats_to_try = []
    
    # Add other supported formats
    for fmt in supported_formats:
        if fmt not in formats_to_try:
            formats_to_try.append(fmt)
    
    # Always add WAV as final fallback
    if 'wav' not in formats_to_try:
        formats_to_try.append('wav')
    
    print(f"Trying formats in order: {formats_to_try}")
    
    for format_type in formats_to_try:
        try:
            if format_type == 'mp3':
                # Try MP3 export with different parameters
                try:
                    # First try with high quality settings
                    audio_segment.export(
                        output_path, 
                        format='mp3',
                        bitrate='192k',
                        parameters=['-ac', '2']
                    )
                    print(f"Successfully exported as MP3 with high quality")
                    return True
                except Exception as mp3_error:
                    print(f"High quality MP3 export failed: {mp3_error}")
                    # Try with basic MP3 export
                    try:
                        audio_segment.export(output_path, format='mp3')
                        print(f"Successfully exported as MP3 with basic settings")
                        return True
                    except Exception as basic_mp3_error:
                        print(f"Basic MP3 export failed: {basic_mp3_error}")
                        continue
            
            elif format_type == 'wav':
                # WAV export is usually most reliable
                audio_segment.export(output_path, format='wav')
                print(f"Successfully exported as WAV")
                return True
                
            elif format_type == 'flac':
                # Try FLAC export
                try:
                    audio_segment.export(output_path, format='flac')
                    print(f"Successfully exported as FLAC")
                    return True
                except Exception as flac_error:
                    print(f"FLAC export failed: {flac_error}")
                    continue
                
        except Exception as format_error:
            print(f"Export to {format_type} failed: {format_error}")
            continue
    
    print("All export formats failed")
    return False

def convert_audio_to_mp3_using_existing_function(audio_segment, output_path):
    """
    Use your existing MP3 conversion function if available
    This function should be implemented based on your existing code
    
    TO INTEGRATE YOUR EXISTING FUNCTION:
    1. Replace the FFmpeg call below with your function
    2. Example: return your_mp3_converter(audio_segment, output_path)
    3. Make sure your function returns True on success, False on failure
    """
    try:
        # If you have a custom MP3 conversion function, call it here
        # For example: your_mp3_converter(audio_segment, output_path)
        
        # For now, we'll use a simple approach
        # Save as WAV first, then convert to MP3 if possible
        temp_wav_path = output_path.replace('.mp3', '_temp.wav')
        
        try:
            # Save as WAV first
            audio_segment.export(temp_wav_path, format='wav')
            
            # Try to convert WAV to MP3 using system tools
            import subprocess
            result = subprocess.run([
                'ffmpeg', '-y', '-i', temp_wav_path, 
                '-acodec', 'libmp3lame', '-ab', '192k', 
                output_path
            ], capture_output=True, text=True)
            
            # Clean up temp WAV file
            if os.path.exists(temp_wav_path):
                os.remove(temp_wav_path)
            
            if result.returncode == 0:
                print(f"Successfully converted to MP3 using FFmpeg")
                return True
            else:
                print(f"FFmpeg conversion failed: {result.stderr}")
                # If FFmpeg fails, just use the WAV file
                os.rename(temp_wav_path, output_path.replace('.mp3', '.wav'))
                return True
                
        except Exception as e:
            print(f"Error in MP3 conversion: {e}")
            # If everything fails, just use WAV
            if os.path.exists(temp_wav_path):
                os.rename(temp_wav_path, output_path.replace('.mp3', '.wav'))
                return True
            return False
            
    except Exception as e:
        print(f"Error in convert_audio_to_mp3_using_existing_function: {e}")
        return False


def split_audio_file(audio_file_path, chunk_duration=CHUNK_DURATION_SECONDS, overlap=OVERLAP_SECONDS):
    """
    Split a large audio file into smaller chunks for processing
    Returns a list of temporary chunk file paths
    """
    try:
        print(f"Splitting audio file: {audio_file_path}")
        
        # Load audio file
        audio = AudioSegment.from_file(audio_file_path)
        duration_ms = len(audio)
        duration_seconds = duration_ms / 1000
        
        print(f"Audio duration: {duration_seconds:.2f} seconds")
        
        # Calculate chunk size in milliseconds
        chunk_duration_ms = chunk_duration * 1000
        overlap_ms = overlap * 1000
        
        # If file is small enough, return original
        if duration_seconds <= chunk_duration:
            print("File is small enough, no splitting needed")
            return [audio_file_path], [0], [duration_seconds]
        
        chunks = []
        start_times = []
        end_times = []
        
        # Create temporary directory for chunks
        temp_dir = tempfile.mkdtemp(dir='uploads/temp')
        
        start_ms = 0
        chunk_index = 0
        
        while start_ms < duration_ms:
            # Calculate end time for this chunk
            end_ms = min(start_ms + chunk_duration_ms, duration_ms)
            
            # Extract chunk with overlap
            if start_ms > 0:
                # Add overlap from previous chunk
                chunk_start = max(0, start_ms - overlap_ms)
            else:
                chunk_start = start_ms
                
            if end_ms < duration_ms:
                # Add overlap to next chunk
                chunk_end = min(duration_ms, end_ms + overlap_ms)
            else:
                chunk_end = end_ms
            
            # Extract the chunk
            chunk = audio[chunk_start:chunk_end]
            
            # Save chunk to temporary file - always use MP3 for compatibility
            chunk_filename = f"chunk_{chunk_index:03d}.mp3"
            chunk_path = os.path.join(temp_dir, chunk_filename)
            
            # Use the robust conversion function
            if convert_audio_to_compatible_format(chunk, chunk_path, 'mp3'):
                print(f"Successfully exported chunk {chunk_index}")
            else:
                # If all formats fail, try to get the original file extension
                original_ext = os.path.splitext(audio_file_path)[1].lower()
                if original_ext and original_ext != '.m4a':  # Avoid m4a format issues
                    try:
                        chunk_path = os.path.join(temp_dir, f"chunk_{chunk_index:03d}{original_ext}")
                        chunk.export(chunk_path, format=original_ext[1:])
                        print(f"Fallback: exported chunk {chunk_index} using original format {original_ext}")
                    except Exception as original_format_error:
                        print(f"Original format export failed: {original_format_error}")
                        # Skip this chunk if all methods fail
                        continue
                else:
                    # Skip this chunk if all methods fail
                    print(f"All export methods failed for chunk {chunk_index}, skipping")
                    continue
            
            chunks.append(chunk_path)
            start_times.append(chunk_start / 1000)  # Convert to seconds
            end_times.append(chunk_end / 1000)      # Convert to seconds
            
            print(f"Created chunk {chunk_index}: {chunk_start/1000:.2f}s - {chunk_end/1000:.2f}s")
            
            # Move to next chunk
            start_ms = end_ms
            chunk_index += 1
        
        if not chunks:
            print("Warning: No chunks were created successfully, returning original file")
            return [audio_file_path], [0], [duration_seconds]
        
        print(f"Successfully split audio into {len(chunks)} chunks")
        return chunks, start_times, end_times
        
    except Exception as e:
        print(f"Error splitting audio file: {e}")
        print(f"Full error details: {str(e)}")
        # If splitting fails, return original file
        return [audio_file_path], [0], [duration_seconds]

def merge_transcription_chunks(chunk_results, start_times, end_times, overlap=OVERLAP_SECONDS):
    """
    Merge transcription results from multiple chunks into a single coherent transcription
    Handles overlapping segments and maintains proper timing
    """
    try:
        print(f"Merging {len(chunk_results)} transcription chunks")
        
        merged_segments = []
        merged_text = ""
        
        for i, chunk_result in enumerate(chunk_results):
            if not chunk_result or 'segments' not in chunk_result:
                print(f"Warning: Chunk {i} has no valid segments")
                continue
            
            chunk_segments = chunk_result['segments']
            chunk_start_time = start_times[i]
            chunk_end_time = end_times[i]
            
            print(f"Processing chunk {i}: {chunk_start_time:.2f}s - {chunk_end_time:.2f}s")
            
            for segment in chunk_segments:
                # Adjust timing to global timeline
                global_start = chunk_start_time + segment.get('start', 0)
                global_end = chunk_start_time + segment.get('end', 0)
                
                # Skip segments that are entirely in overlap regions (except for first chunk)
                if i > 0:  # Not the first chunk
                    overlap_start = chunk_start_time - overlap
                    if global_start < overlap_start:
                        continue
                
                # Create merged segment
                merged_segment = {
                    'id': len(merged_segments),
                    'text': segment.get('text', ''),
                    'start': global_start,
                    'end': global_end,
                    'confidence': segment.get('confidence', 0),
                    'avg_logprob': segment.get('avg_logprob', 0),
                    'compression_ratio': segment.get('compression_ratio', 0),
                    'no_speech_prob': segment.get('no_speech_prob', 0),
                    'speaker': segment.get('speaker', 'unknown')
                }
                
                merged_segments.append(merged_segment)
                
                # Add to merged text
                if merged_text:
                    merged_text += " "
                merged_text += segment.get('text', '')
        
        # Sort segments by start time
        merged_segments.sort(key=lambda x: x['start'])
        
        # Reassign IDs to be sequential
        for i, segment in enumerate(merged_segments):
            segment['id'] = i
        
        # Calculate overall statistics
        total_duration = max(segment['end'] for segment in merged_segments) if merged_segments else 0
        avg_confidence = sum(segment['confidence'] for segment in merged_segments) / len(merged_segments) if merged_segments else 0
        
        merged_result = {
            'status': 'success',
            'full_text': merged_text,
            'segments': merged_segments,
            'duration': total_duration,
            'language': chunk_results[0].get('language', 'es') if chunk_results else 'es',
            'chunk_count': len(chunk_results),
            'avg_confidence': avg_confidence
        }
        
        print(f"Successfully merged transcription: {len(merged_segments)} segments, {total_duration:.2f}s duration")
        return merged_result
        
    except Exception as e:
        print(f"Error merging transcription chunks: {e}")
        # Return a basic merged result if merging fails
        return {
            'status': 'error',
            'error': f'Failed to merge chunks: {str(e)}',
            'full_text': ' '.join([r.get('full_text', '') for r in chunk_results if r]),
            'segments': [],
            'duration': 0,
            'language': 'es'
        }

def process_large_audio_transcription(audio_file_path, user_id):
    """
    Process large audio files by splitting them into chunks, transcribing each chunk,
    and then merging the results
    """
    try:
        print(f"Processing large audio file: {audio_file_path}")
        
        # Split audio into chunks
        chunks, start_times, end_times = split_audio_file(audio_file_path)
        
        if len(chunks) == 1:
            print("File is small enough, processing normally")
            return transcribe_audio(audio_file_path)
        
        print(f"Processing {len(chunks)} chunks...")
        
        # Process each chunk with progress tracking
        chunk_results = []
        successful_chunks = 0
        failed_chunks = 0
        
        for i, chunk_path in enumerate(chunks):
            try:
                print(f"Processing chunk {i+1}/{len(chunks)}: {chunk_path}")
                
                # Emit progress update
                progress_data = {
                    'chunk_current': i + 1,
                    'chunk_total': len(chunks),
                    'progress_percentage': int(((i + 1) / len(chunks)) * 100),
                    'status': f'Processing chunk {i+1} of {len(chunks)}'
                }
                
                # Try to emit progress (if user is connected)
                try:
                    socketio.emit('transcription_progress', progress_data, room=f'user-{user_id}')
                except:
                    pass  # Ignore if user not connected
                
                # Transcribe chunk
                chunk_result = transcribe_audio(chunk_path)
                
                if chunk_result and chunk_result.get('status') != 'error':
                    chunk_results.append(chunk_result)
                    successful_chunks += 1
                    print(f"Chunk {i+1} processed successfully")
                else:
                    error_msg = chunk_result.get('error', 'Unknown error') if chunk_result else 'No result'
                    print(f"Chunk {i+1} failed: {error_msg}")
                    failed_chunks += 1
                    # Add empty result to maintain indexing
                    chunk_results.append({
                        'status': 'error',
                        'error': error_msg,
                        'segments': [],
                        'full_text': ''
                    })
                    
            except Exception as e:
                print(f"Error processing chunk {i+1}: {e}")
                failed_chunks += 1
                chunk_results.append({
                    'status': 'error',
                    'error': str(e),
                    'segments': [],
                    'full_text': ''
                })
        
        print(f"Chunk processing completed: {successful_chunks} successful, {failed_chunks} failed")
        
        # Clean up temporary chunk files
        try:
            for chunk_path in chunks:
                if chunk_path != audio_file_path:  # Don't delete original file
                    if os.path.exists(chunk_path):
                        os.remove(chunk_path)
                        print(f"Cleaned up temporary chunk: {chunk_path}")
            
            # Remove temporary directory
            temp_dir = os.path.dirname(chunks[0]) if chunks and chunks[0] != audio_file_path else None
            if temp_dir and os.path.exists(temp_dir) and 'temp' in temp_dir:
                shutil.rmtree(temp_dir)
                print(f"Cleaned up temporary directory: {temp_dir}")
        except Exception as cleanup_error:
            print(f"Warning: Error during cleanup: {cleanup_error}")
        
        # Merge results
        if chunk_results:
            print("Merging transcription chunks...")
            merged_result = merge_transcription_chunks(chunk_results, start_times, end_times)
            
            # Emit completion progress
            try:
                socketio.emit('transcription_progress', {
                    'chunk_current': len(chunks),
                    'chunk_total': len(chunks),
                    'progress_percentage': 100,
                    'status': 'Merging transcription results...'
                }, room=f'user-{user_id}')
            except:
                pass
            
            return merged_result
        else:
            return {
                'status': 'error',
                'error': 'All chunks failed to process'
            }
            
    except Exception as e:
        print(f"Error in process_large_audio_transcription: {e}")
        return {
            'status': 'error',
            'error': str(e)
        }

def super_admin_required(f):
    """Decorator to require super admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user or user.get('role') != 'super_admin':
            return jsonify({'error': 'Super admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Decorator to require admin or super admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = db.users.find_one({'_id': ObjectId(current_user_id)})
        if not user or user.get('role') not in ['admin', 'super_admin']:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Authentication Routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user in database
        user = db.users.find_one({'email': email})
        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check if user is active
        if not user.get('is_active', True):
            return jsonify({'error': 'Account Inactive. Please contact administrator'}), 401
        
        # Update last login
        db.users.update_one(
            {'_id': user['_id']},
            {'$set': {'last_login': datetime.utcnow()}}
        )
        
        # Create access token
        access_token = create_access_token(identity=str(user['_id']))
        
        # Determine redirect path based on user role
        redirect_path = '/dashboard'  # Default for doctors
        if user.get('role') in ['admin', 'super_admin']:
            redirect_path = '/super-admin'
        
        return jsonify({
            'access_token': access_token,
            'user': serialize_doc(user),
            'redirect_to': redirect_path
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'full_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if user already exists
        if db.users.find_one({'email': data['email']}):
            return jsonify({'error': 'User already exists'}), 409
        
        # Create new user
        user_data = {
            'email': data['email'],
            'password_hash': generate_password_hash(data['password']),
            'full_name': data['full_name'],
            'role': 'doctor',
            'is_active': True,
            'language': 'en',
            'phone': '',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # If subscription plan is provided, add it to user data
        if data.get('subscription_plan_id') and data['subscription_plan_id'].strip():
            user_data['subscription_plan_id'] = data['subscription_plan_id']
        
        result = db.users.insert_one(user_data)
        user_data['_id'] = result.inserted_id
        
        # Create access token
        access_token = create_access_token(identity=str(result.inserted_id))
        
        return jsonify({
            'access_token': access_token,
            'user': serialize_doc(user_data)
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': serialize_doc(user)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# User Settings Routes
@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({
            'fullName': user.get('full_name', ''),
            'email': user.get('email', ''),
            'phone': user.get('phone', '')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['PUT'])
@jwt_required()
def update_user_profile():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        update_data = {
            'full_name': data.get('fullName', ''),
            'email': data.get('email', ''),
            'phone': data.get('phone', ''),
            'updated_at': datetime.utcnow()
        }
        db.users.update_one({'_id': ObjectId(user_id)}, {'$set': update_data})
        return jsonify({'message': 'Profile updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/change-password', methods=['POST'])
@jwt_required()
def change_password():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')
        if not current_password or not new_password:
            return jsonify({'error': 'Current and new password are required'}), 400
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user or not check_password_hash(user['password_hash'], current_password):
            return jsonify({'error': 'Current password is incorrect'}), 400
        db.users.update_one({'_id': ObjectId(user_id)}, {'$set': {'password_hash': generate_password_hash(new_password)}})
        return jsonify({'message': 'Password changed successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/language', methods=['GET'])
@jwt_required()
def get_user_language():
    try:
        user_id = get_jwt_identity()
        user = db.users.find_one({'_id': ObjectId(user_id)})
        return jsonify({'language': user.get('language', 'en')})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/language', methods=['PUT'])
@jwt_required()
def update_user_language():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        language = data.get('language', 'en')
        db.users.update_one({'_id': ObjectId(user_id)}, {'$set': {'language': language}})
        return jsonify({'message': 'Language updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Super Admin Routes
@app.route('/api/super-admin/stats', methods=['GET'])
@jwt_required()
@super_admin_required
def get_super_admin_stats():
    try:
        # Calculate system statistics
        total_users = db.users.count_documents({})
        active_users = db.users.count_documents({'is_active': True})
        total_consultations = db.consultations.count_documents({})
        pending_transcriptions = db.transcriptions.count_documents({'status': 'processing'})
        
        # Calculate storage usage (in GB)
        # This is a simplified calculation - in production you'd want more accurate storage tracking
        total_file_size = 0
        for consultation in db.consultations.find({'audio_file_size': {'$exists': True}}):
            total_file_size += consultation.get('audio_file_size', 0)
        
        storage_usage = round(total_file_size / (1024 * 1024 * 1024), 2)  # Convert to GB
        storage_limit = 1000  # 1TB limit example
        
        # Calculate trial plan statistics
        trial_plans = list(db.subscription_plans.find({'interval': 'trial', 'active': True}))
        users_on_trial = db.user_subscriptions.count_documents({'status': 'trialing'})
        doctors_without_plan = db.users.count_documents({
            'role': 'doctor',
            'subscription_plan_id': {'$exists': False}
        })
        total_doctors = db.users.count_documents({'role': 'doctor'})
        
        # Determine system health
        system_health = 'healthy'
        if storage_usage > storage_limit * 0.9:
            system_health = 'error'
        elif storage_usage > storage_limit * 0.7:
            system_health = 'warning'
        
        return jsonify({
            'totalUsers': total_users,
            'activeUsers': active_users,
            'totalConsultations': total_consultations,
            'pendingTranscriptions': pending_transcriptions,
            'systemHealth': system_health,
            'serverStatus': 'online',
            'storageUsage': storage_usage,
            'storageLimit': storage_limit,
            'trialPlanStats': {
                'availableTrialPlans': len(trial_plans),
                'usersOnTrial': users_on_trial,
                'doctorsWithoutPlan': doctors_without_plan,
                'totalDoctors': total_doctors
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/users', methods=['GET'])
@jwt_required()
@super_admin_required
def get_all_users():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        search = request.args.get('search', '')
        
        # Build query
        query = {}
        if search:
            query['$or'] = [
                {'full_name': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get users with pagination
        skip = (page - 1) * limit
        query['role'] = {'$ne': 'super_admin'}
        users = list(db.users.find(query, {'password_hash': 0}).skip(skip).limit(limit).sort('created_at', -1))
        total = db.users.count_documents(query)
        
        return jsonify({
            'users': serialize_doc(users),
            'total': total,
            'page': page,
            'pages': (total + limit - 1) // limit
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/users', methods=['POST'])
@jwt_required()
@super_admin_required
def create_user():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'password', 'full_name', 'role']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if user already exists
        if db.users.find_one({'email': data['email']}):
            return jsonify({'error': 'User already exists'}), 409
        
        # Validate role
        allowed_roles = ['doctor', 'admin', 'super_admin']
        if data['role'] not in allowed_roles:
            return jsonify({'error': 'Invalid role'}), 400
        
        # Create new user
        user_data = {
            'email': data['email'],
            'password_hash': generate_password_hash(data['password']),
            'full_name': data['full_name'],
            'role': data['role'],
            'is_active': True,
            'language': 'en',
            'phone': '',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # If subscription plan is provided, add it to user data
        if data.get('subscription_plan_id') and data['subscription_plan_id'].strip():
            user_data['subscription_plan_id'] = data['subscription_plan_id']
        
        result = db.users.insert_one(user_data)
        user_data['_id'] = result.inserted_id
        
        # If subscription plan is provided, create user subscription
        if data.get('subscription_plan_id') and data['subscription_plan_id'].strip():
            # Validate subscription plan exists
            plan = db.subscription_plans.find_one({'_id': ObjectId(data['subscription_plan_id'])})
            if not plan:
                return jsonify({'error': 'Subscription plan not found'}), 404
            
            # Create user subscription (free access without Stripe payment)
            # For trial plans, give exactly 30 days (1 month) regardless of plan.trial_days
            # For regular plans, give 1 year access
            if plan.get('interval') == 'trial':
                period_end = datetime.utcnow() + timedelta(days=30)  # Exactly 30 days
                status = 'trialing'
            else:
                period_end = datetime.utcnow() + timedelta(days=365)  # 1 year
                status = 'active'
            
            subscription_data = {
                'userId': str(result.inserted_id),
                'planId': data['subscription_plan_id'],
                'stripeSubscriptionId': None,  # No Stripe subscription for manually added users
                'stripeCustomerId': None,      # No Stripe customer for manually added users
                'status': status,
                'currentPeriodStart': datetime.utcnow(),
                'currentPeriodEnd': period_end,
                'cancelAtPeriodEnd': False,
                'is_manual_subscription': True,  # Flag to identify manually added subscriptions
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            db.user_subscriptions.insert_one(subscription_data)
        
        # Remove password_hash from response
        user_response = serialize_doc(user_data)
        user_response.pop('password_hash', None)
        
        return jsonify({'user': user_response}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/users/<user_id>', methods=['PUT'])
@jwt_required()
@super_admin_required
def update_user(user_id):
    try:
        data = request.get_json()
        current_user_id = get_jwt_identity()
        
        # Prevent self-modification of critical fields
        if user_id == current_user_id and 'role' in data:
            return jsonify({'error': 'Cannot modify your own role'}), 400
        
        # Check if user exists
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Build update data
        update_data = {'updated_at': datetime.utcnow()}
        allowed_fields = ['full_name', 'email', 'role', 'is_active', 'phone']
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Validate role if provided
        if 'role' in data:
            allowed_roles = ['doctor', 'admin', 'super_admin']
            if data['role'] not in allowed_roles:
                return jsonify({'error': 'Invalid role'}), 400
        
        # Handle subscription plan updates for doctors
        if data.get('role') == 'doctor' and 'subscription_plan_id' in data:
            subscription_plan_id = data['subscription_plan_id']
            
            # If subscription plan is being removed (empty string)
            if not subscription_plan_id or subscription_plan_id.strip() == '':
                # Remove existing subscription
                db.user_subscriptions.delete_many({'userId': user_id})
                # Update user to remove subscription reference
                update_data['subscription_plan_id'] = None
            else:
                # Validate subscription plan exists
                plan = db.subscription_plans.find_one({'_id': ObjectId(subscription_plan_id)})
                if not plan:
                    return jsonify({'error': 'Subscription plan not found'}), 404
                
                # Update user with subscription plan reference
                update_data['subscription_plan_id'] = subscription_plan_id
                
                # Check if user already has a subscription
                existing_subscription = db.user_subscriptions.find_one({'userId': user_id})
                
                if existing_subscription:
                    # Update existing subscription
                    db.user_subscriptions.update_one(
                        {'userId': user_id},
                        {
                            '$set': {
                                'planId': subscription_plan_id,
                                'updated_at': datetime.utcnow()
                            }
                        }
                    )
                else:
                    # Create new subscription
                    # For trial plans, give exactly 30 days (1 month) regardless of plan.trial_days
                    # For regular plans, give 1 year access
                    if plan.get('interval') == 'trial':
                        period_end = datetime.utcnow() + timedelta(days=30)  # Exactly 30 days
                        status = 'trialing'
                    else:
                        period_end = datetime.utcnow() + timedelta(days=365)  # 1 year
                        status = 'active'
                    
                    subscription_data = {
                        'userId': user_id,
                        'planId': subscription_plan_id,
                        'stripeSubscriptionId': None,  # No Stripe subscription for manually added users
                        'stripeCustomerId': None,      # No Stripe customer for manually added users
                        'status': status,
                        'currentPeriodStart': datetime.utcnow(),
                        'currentPeriodEnd': period_end,
                        'cancelAtPeriodEnd': False,
                        'is_manual_subscription': True,  # Flag to identify manually added subscriptions
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    }
                    
                    db.user_subscriptions.insert_one(subscription_data)
        
        db.users.update_one({'_id': ObjectId(user_id)}, {'$set': update_data})
        
        # Get updated user
        updated_user = db.users.find_one({'_id': ObjectId(user_id)}, {'password_hash': 0})
        
        return jsonify({'user': serialize_doc(updated_user)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/users/<user_id>', methods=['DELETE'])
@jwt_required()
@super_admin_required
def delete_user(user_id):
    try:
        current_user_id = get_jwt_identity()
        
        # Prevent self-deletion
        if user_id == current_user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        # Check if user exists
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Delete user's related data
        db.patients.delete_many({'doctor_id': user_id})
        db.consultations.delete_many({'doctor_id': user_id})
        db.transcriptions.delete_many({'doctor_id': user_id})
        db.reports.delete_many({'doctor_id': user_id})
        
        # Delete user
        db.users.delete_one({'_id': ObjectId(user_id)})
        
        return jsonify({'message': 'User deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/users/<user_id>/toggle-status', methods=['PATCH'])
@jwt_required()
@super_admin_required
def toggle_user_status(user_id):
    try:
        current_user_id = get_jwt_identity()
        
        # Prevent self-deactivation
        if user_id == current_user_id:
            return jsonify({'error': 'Cannot deactivate your own account'}), 400
        
        # Check if user exists
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        new_status = not user.get('is_active', True)
        
        db.users.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'is_active': new_status,
                'updated_at': datetime.utcnow()
            }}
        )
        
        updated_user = db.users.find_one({'_id': ObjectId(user_id)}, {'password_hash': 0})
        
        return jsonify({
            'user': serialize_doc(updated_user),
            'message': f'User {"activated" if new_status else "deactivated"} successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Language Management Routes
@app.route('/api/super-admin/languages', methods=['GET'])
@jwt_required()
@super_admin_required
def get_languages():
    try:
        # Get supported languages configuration
        languages = db.languages.find({}).sort('name', 1)
        return jsonify({'languages': serialize_doc(list(languages))})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/languages', methods=['POST'])
@jwt_required()
@super_admin_required
def add_language():
    try:
        data = request.get_json()
        
        required_fields = ['code', 'name', 'enabled']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if language already exists
        if db.languages.find_one({'code': data['code']}):
            return jsonify({'error': 'Language already exists'}), 409
        
        language_data = {
            'code': data['code'],
            'name': data['name'],
            'enabled': data['enabled'],
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.languages.insert_one(language_data)
        language_data['_id'] = result.inserted_id
        
        return jsonify({'language': serialize_doc(language_data)}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/languages/<language_id>', methods=['PUT'])
@jwt_required()
@super_admin_required
def update_language(language_id):
    try:
        data = request.get_json()
        
        update_data = {'updated_at': datetime.utcnow()}
        allowed_fields = ['name', 'enabled']
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        result = db.languages.update_one(
            {'_id': ObjectId(language_id)},
            {'$set': update_data}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Language not found'}), 404
        
        updated_language = db.languages.find_one({'_id': ObjectId(language_id)})
        return jsonify({'language': serialize_doc(updated_language)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/languages/<language_id>', methods=['DELETE'])
@jwt_required()
@super_admin_required
def delete_language(language_id):
    try:
        result = db.languages.delete_one({'_id': ObjectId(language_id)})
        
        if result.deleted_count == 0:
            return jsonify({'error': 'Language not found'}), 404
        
        return jsonify({'message': 'Language deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Subscription Plans Management Routes (Super Admin)
@app.route('/api/super-admin/subscription-plans', methods=['GET'])
@jwt_required()
@super_admin_required
def get_subscription_plans_admin():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        search = request.args.get('search', '')
        status = request.args.get('status', 'all')  # all, active, inactive
        
        # Build query
        query = {}
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'description': {'$regex': search, '$options': 'i'}}
            ]
        
        if status == 'active':
            query['active'] = True
        elif status == 'inactive':
            query['active'] = False
        
        # Get plans with pagination
        skip = (page - 1) * limit
        plans = list(db.subscription_plans.find(query).skip(skip).limit(limit).sort('created_at', -1))
        total = db.subscription_plans.count_documents(query)
        
        # Add subscription count for each plan
        for plan in plans:
            plan['subscription_count'] = db.user_subscriptions.count_documents({
                'planId': str(plan['_id']),
                'status': {'$in': ['active', 'trialing']}
            })
        
        return jsonify({
            'plans': serialize_doc(plans),
            'total': total,
            'page': page,
            'pages': (total + limit - 1) // limit,
            'hasMore': page < (total + limit - 1) // limit
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans/<plan_id>', methods=['GET'])
@jwt_required()
@super_admin_required
def get_subscription_plan_admin(plan_id):
    try:
        plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        if not plan:
            return jsonify({'error': 'Plan not found'}), 404
        
        # Add detailed statistics
        plan['statistics'] = {
            'active_subscriptions': db.user_subscriptions.count_documents({
                'planId': plan_id,
                'status': {'$in': ['active', 'trialing']}
            }),
            'total_subscriptions': db.user_subscriptions.count_documents({'planId': plan_id}),
            'monthly_revenue': 0,  # Calculate based on active subscriptions
            'signup_trend': []  # Last 12 months signup trend
        }
        
        # Calculate revenue
        active_subs = db.user_subscriptions.count_documents({
            'planId': plan_id,
            'status': {'$in': ['active', 'trialing']}
        })
        
        if plan['interval'] == 'month':
            plan['statistics']['monthly_revenue'] = active_subs * plan['price']
        elif plan['interval'] == 'year':
            plan['statistics']['monthly_revenue'] = active_subs * (plan['price'] / 12)
        
        return jsonify({'plan': serialize_doc(plan)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans', methods=['POST'])
@jwt_required()
@super_admin_required
def create_subscription_plan():
    try:
        data = request.get_json()
        
        # For trial plans, price is optional
        if data.get('interval') == 'trial':
            required_fields = ['name', 'description', 'currency', 'interval', 'transcriptionsPerMonth', 'diskSpaceGB', 'trial_days']
        else:
            required_fields = ['name', 'description', 'price', 'currency', 'interval', 'transcriptionsPerMonth', 'diskSpaceGB']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate data
        if data['interval'] != 'trial' and data['price'] <= 0:
            return jsonify({'error': 'Price must be greater than 0 for non-trial plans'}), 400
        
        if data['interval'] not in ['month', 'year', 'trial']:
            return jsonify({'error': 'Interval must be month, year, or trial'}), 400
        
        # Validate trial days for trial plans
        if data['interval'] == 'trial':
            if not data.get('trial_days') or data['trial_days'] <= 0:
                return jsonify({'error': 'Trial days must be greater than 0 for trial plans'}), 400
        
        if data['transcriptionsPerMonth'] <= 0:
            return jsonify({'error': 'Transcriptions per month must be greater than 0'}), 400
        
        if data['diskSpaceGB'] <= 0:
            return jsonify({'error': 'Disk space must be greater than 0'}), 400
        
        # Check if plan name already exists
        existing_plan = db.subscription_plans.find_one({'name': data['name'], 'interval': data['interval']})
        if existing_plan:
            return jsonify({'error': 'Plan with this name and interval already exists'}), 409
        
        # Only create Stripe price for non-trial plans
        stripe_price_id = None
        if data['interval'] != 'trial':
            try:
                # Create Stripe price
                stripe_price = stripe.Price.create(
                    unit_amount=int(data['price'] * 100),  # Convert to cents
                    currency=data['currency'].lower(),
                    recurring={'interval': data['interval']},
                    product_data={
                        'name': f"{data['name']} ({data['interval']}ly)"
                    }
                )
                stripe_price_id = stripe_price.id
            except Exception as stripe_error:
                return jsonify({'error': f'Stripe error: {str(stripe_error)}'}), 400
        
        plan_data = {
            'name': data['name'],
            'description': data['description'],
            'price': data.get('price', 0) if data['interval'] == 'trial' else data['price'],
            'currency': data['currency'].upper(),
            'interval': data['interval'],
            'transcriptionsPerMonth': data['transcriptionsPerMonth'],
            'diskSpaceGB': data['diskSpaceGB'],
            'features': data.get('features', []),
            'stripePriceId': stripe_price_id,
            'active': data.get('active', True),
            'popular': data.get('popular', False),
            'trial_days': data.get('trial_days', 0),
            'admin_only': data.get('admin_only', False),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.subscription_plans.insert_one(plan_data)
        plan_data['_id'] = result.inserted_id
        
        return jsonify({'plan': serialize_doc(plan_data)}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans/<plan_id>', methods=['PUT'])
@jwt_required()
@super_admin_required
def update_subscription_plan(plan_id):
    try:
        data = request.get_json()
        
        plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        if not plan:
            return jsonify({'error': 'Plan not found'}), 404
        
        # For trial plans, don't require stripePriceId
        if plan.get('interval') == 'trial':
            if not plan.get('stripePriceId'):
                # This is expected for trial plans
                pass
        else:
            if not plan.get('stripePriceId'):
                return jsonify({'error': 'Plan is not configured for Stripe payments'}), 400
        
        update_data = {'updated_at': datetime.utcnow()}
        allowed_fields = ['name', 'description', 'features', 'active', 'popular', 'trial_days', 'admin_only']
        
        for field in allowed_fields:
            if field in data:
                if field == 'name' and data[field] != plan['name']:
                    # Check if new name already exists
                    existing = db.subscription_plans.find_one({
                        'name': data[field], 
                        'interval': plan['interval'],
                        '_id': {'$ne': ObjectId(plan_id)}
                    })
                    if existing:
                        return jsonify({'error': 'Plan with this name already exists'}), 409
                
                update_data[field] = data[field]
        
        # Update Stripe product if name or description changed (only for non-trial plans)
        if plan.get('interval') != 'trial' and plan.get('stripePriceId'):
            if 'name' in data or 'description' in data:
                try:
                    # Get the Stripe price to find the product
                    stripe_price = stripe.Price.retrieve(plan['stripePriceId'])
                    stripe.Product.modify(
                        stripe_price.product,
                        name=data.get('name', plan['name']),
                        description=data.get('description', plan['description'])
                    )
                except Exception as stripe_error:
                    print(f"Stripe update error: {stripe_error}")
                    # Continue with database update even if Stripe update fails
        
        db.subscription_plans.update_one(
            {'_id': ObjectId(plan_id)},
            {'$set': update_data}
        )
        
        updated_plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        return jsonify({'plan': serialize_doc(updated_plan)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans/<plan_id>', methods=['DELETE'])
@jwt_required()
@super_admin_required
def delete_subscription_plan(plan_id):
    try:
        plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        if not plan:
            return jsonify({'error': 'Plan not found'}), 404
        
        # Check if plan has active subscriptions
        active_subscriptions = db.user_subscriptions.count_documents({
            'planId': plan_id,
            'status': {'$in': ['active', 'trialing']}
        })
        
        if active_subscriptions > 0:
            return jsonify({
                'error': f'Cannot delete plan with {active_subscriptions} active subscriptions. Deactivate the plan instead.'
            }), 400
        
        # Archive the Stripe price instead of deleting (only for non-trial plans)
        if plan.get('interval') != 'trial' and plan.get('stripePriceId'):
            try:
                stripe.Price.modify(plan['stripePriceId'], active=False)
            except Exception as stripe_error:
                print(f"Stripe archive error: {stripe_error}")
        
        # Soft delete - mark as deleted instead of actually deleting
        db.subscription_plans.update_one(
            {'_id': ObjectId(plan_id)},
            {'$set': {
                'deleted': True,
                'deleted_at': datetime.utcnow(),
                'active': False
            }}
        )
        
        return jsonify({'message': 'Plan deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans/<plan_id>/toggle-status', methods=['PATCH'])
@jwt_required()
@super_admin_required
def toggle_plan_status(plan_id):
    try:
        plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        if not plan:
            return jsonify({'error': 'Plan not found'}), 404
        
        new_status = not plan.get('active', True)
        
        db.subscription_plans.update_one(
            {'_id': ObjectId(plan_id)},
            {'$set': {
                'active': new_status,
                'updated_at': datetime.utcnow()
            }}
        )
        
        # Update Stripe price status (only for non-trial plans)
        if plan.get('interval') != 'trial' and plan.get('stripePriceId'):
            try:
                stripe.Price.modify(plan['stripePriceId'], active=new_status)
            except Exception as stripe_error:
                print(f"Stripe status update error: {stripe_error}")
        
        updated_plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        return jsonify({
            'plan': serialize_doc(updated_plan),
            'message': f'Plan {"activated" if new_status else "deactivated"} successfully'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans/<plan_id>/duplicate', methods=['POST'])
@jwt_required()
@super_admin_required
def duplicate_subscription_plan(plan_id):
    try:
        original_plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        if not original_plan:
            return jsonify({'error': 'Plan not found'}), 404
        
        data = request.get_json()
        new_name = data.get('name', f"{original_plan['name']} Copy")
        new_interval = data.get('interval', original_plan['interval'])
        
        # Check if new name and interval combination exists
        existing = db.subscription_plans.find_one({'name': new_name, 'interval': new_interval})
        if existing:
            return jsonify({'error': 'Plan with this name and interval already exists'}), 409
        
        # Create new Stripe price (only for non-trial plans)
        stripe_price_id = None
        if original_plan.get('interval') != 'trial':
            try:
                stripe_price = stripe.Price.create(
                    unit_amount=int(original_plan['price'] * 100),
                    currency=original_plan['currency'].lower(),
                    recurring={'interval': new_interval},
                    product_data={
                        'name': f"{new_name} ({new_interval}ly)"
                    }
                )
                stripe_price_id = stripe_price.id
            except Exception as stripe_error:
                return jsonify({'error': f'Stripe error: {str(stripe_error)}'}), 400
        
        # Create new plan
        new_plan_data = {
            'name': new_name,
            'description': original_plan['description'],
            'price': original_plan['price'],
            'currency': original_plan['currency'],
            'interval': new_interval,
            'transcriptionsPerMonth': original_plan['transcriptionsPerMonth'],
            'diskSpaceGB': original_plan['diskSpaceGB'],
            'features': original_plan['features'].copy(),
            'stripePriceId': stripe_price_id,
            'active': False,  # Start as inactive
            'popular': False,
            'trial_days': original_plan.get('trial_days', 0),
            'admin_only': original_plan.get('admin_only', False),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.subscription_plans.insert_one(new_plan_data)
        new_plan_data['_id'] = result.inserted_id
        
        return jsonify({'plan': serialize_doc(new_plan_data)}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Public Subscription Plans API (User-facing)
@app.route('/api/subscription/plans', methods=['GET'])
def get_available_plans():
    """Get all active subscription plans for users to view"""
    try:
        # Only return active plans that are not admin-only and not trial plans
        plans = list(db.subscription_plans.find({
            'active': True,
            'deleted': {'$ne': True},
            'admin_only': {'$ne': True},
            'interval': {'$ne': 'trial'}  # Exclude trial plans from public API
        }).sort('price', 1))
        
        # Remove sensitive information
        public_plans = []
        for plan in plans:
            public_plan = {
                'id': str(plan['_id']),
                'name': plan['name'],
                'description': plan['description'],
                'price': plan['price'],
                'currency': plan['currency'],
                'interval': plan['interval'],
                'transcriptionsPerMonth': plan['transcriptionsPerMonth'],
                'diskSpaceGB': plan['diskSpaceGB'],
                'features': plan['features'],
                'popular': plan.get('popular', False),
                'trial_days': plan.get('trial_days', 0)
            }
            public_plans.append(public_plan)
        
        return jsonify({'plans': public_plans})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/plans/<plan_id>', methods=['GET'])
def get_plan_details(plan_id):
    """Get detailed information about a specific plan"""
    try:
        plan = db.subscription_plans.find_one({
            '_id': ObjectId(plan_id),
            'active': True,
            'deleted': {'$ne': True},
            'admin_only': {'$ne': True},
            'interval': {'$ne': 'trial'}  # Exclude trial plans from public API
        })
        
        if not plan:
            return jsonify({'error': 'Plan not found or inactive'}), 404
        
        # Return public plan details
        public_plan = {
            'id': str(plan['_id']),
            'name': plan['name'],
            'description': plan['description'],
            'price': plan['price'],
            'currency': plan['currency'],
            'interval': plan['interval'],
            'transcriptionsPerMonth': plan['transcriptionsPerMonth'],
            'diskSpaceGB': plan['diskSpaceGB'],
            'features': plan['features'],
            'popular': plan.get('popular', False),
            'trial_days': plan.get('trial_days', 0)
        }
        
        return jsonify({'plan': public_plan})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/plans/compare', methods=['POST'])
def compare_plans():
    """Compare multiple subscription plans"""
    try:
        data = request.get_json()
        plan_ids = data.get('plan_ids', [])
        
        if not plan_ids:
            return jsonify({'error': 'Plan IDs are required'}), 400
        
        if len(plan_ids) > 5:
            return jsonify({'error': 'Cannot compare more than 5 plans'}), 400
        
        plans = []
        for plan_id in plan_ids:
            plan = db.subscription_plans.find_one({
                '_id': ObjectId(plan_id),
                'active': True,
                'deleted': {'$ne': True},
                'interval': {'$ne': 'trial'}  # Exclude trial plans from public API
            })
            if plan:
                public_plan = {
                    'id': str(plan['_id']),
                    'name': plan['name'],
                    'description': plan['description'],
                    'price': plan['price'],
                    'currency': plan['currency'],
                    'interval': plan['interval'],
                    'transcriptionsPerMonth': plan['transcriptionsPerMonth'],
                    'diskSpaceGB': plan['diskSpaceGB'],
                    'features': plan['features'],
                    'popular': plan.get('popular', False),
                    'trial_days': plan.get('trial_days', 0)
                }
                plans.append(public_plan)
        return jsonify({'plans': plans})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Subscription Plans Analytics (Super Admin)
@app.route('/api/super-admin/subscription-plans/analytics', methods=['GET'])
@jwt_required()
@super_admin_required
def get_subscription_analytics():
    """Get comprehensive analytics for subscription plans"""
    try:
        # Date range parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        if not end_date:
            end_date = datetime.utcnow().isoformat()
        
        start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        analytics = {
            'overview': {
                'total_plans': db.subscription_plans.count_documents({'deleted': {'$ne': True}}),
                'active_plans': db.subscription_plans.count_documents({'active': True, 'deleted': {'$ne': True}}),
                'total_subscriptions': db.user_subscriptions.count_documents({}),
                'active_subscriptions': db.user_subscriptions.count_documents({'status': {'$in': ['active', 'trialing']}}),
                'total_revenue': 0,
                'monthly_recurring_revenue': 0
            },
            'plan_performance': [],
            'subscription_trends': [],
            'revenue_breakdown': {
                'by_plan': [],
                'by_interval': {'month': 0, 'year': 0}
            }
        }
        
        # Calculate plan performance
        plans = list(db.subscription_plans.find({'deleted': {'$ne': True}}))
        for plan in plans:
            plan_id = str(plan['_id'])
            
            # Get subscription counts
            total_subs = db.user_subscriptions.count_documents({'planId': plan_id})
            active_subs = db.user_subscriptions.count_documents({
                'planId': plan_id,
                'status': {'$in': ['active', 'trialing']}
            })
            
            # Calculate revenue
            plan_revenue = active_subs * plan['price']
            if plan['interval'] == 'year':
                monthly_revenue = plan_revenue / 12
            else:
                monthly_revenue = plan_revenue
            
            analytics['overview']['monthly_recurring_revenue'] += monthly_revenue
            analytics['overview']['total_revenue'] += plan_revenue
            
            # Add to revenue breakdown
            analytics['revenue_breakdown']['by_interval'][plan['interval']] += plan_revenue
            analytics['revenue_breakdown']['by_plan'].append({
                'plan_name': plan['name'],
                'plan_id': plan_id,
                'revenue': plan_revenue,
                'active_subscriptions': active_subs
            })
            
            plan_performance = {
                'plan_id': plan_id,
                'plan_name': plan['name'],
                'interval': plan['interval'],
                'price': plan['price'],
                'total_subscriptions': total_subs,
                'active_subscriptions': active_subs,
                'churn_rate': 0,  # Calculate if needed
                'revenue': plan_revenue,
                'conversion_rate': 0  # Calculate if needed
            }
            analytics['plan_performance'].append(plan_performance)
        
        # Get subscription trends (daily signups in the date range)
        pipeline = [
            {
                '$match': {
                    'created_at': {'$gte': start_date, '$lte': end_date}
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': {'$year': '$created_at'},
                        'month': {'$month': '$created_at'},
                        'day': {'$dayOfMonth': '$created_at'}
                    },
                    'count': {'$sum': 1}
                }
            },
            {
                '$sort': {'_id': 1}
            }
        ]
        
        subscription_trends = list(db.user_subscriptions.aggregate(pipeline))
        for trend in subscription_trends:
            date_str = f"{trend['_id']['year']}-{trend['_id']['month']:02d}-{trend['_id']['day']:02d}"
            analytics['subscription_trends'].append({
                'date': date_str,
                'subscriptions': trend['count']
            })
        
        return jsonify({'analytics': analytics})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans/export', methods=['GET'])
@jwt_required()
@super_admin_required
def export_subscription_plans():
    """Export subscription plans data as CSV"""
    try:
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # Write headers
        headers = ['Plan ID', 'Name', 'Description', 'Price', 'Currency', 'Interval', 
                  'Transcriptions/Month', 'Disk Space (GB)', 'Features', 'Active', 
                  'Popular', 'Trial Days', 'Active Subscriptions', 'Total Revenue', 'Created At']
        writer.writerow(headers)
        
        # Get all plans with subscription data
        plans = list(db.subscription_plans.find({'deleted': {'$ne': True}}))
        for plan in plans:
            plan_id = str(plan['_id'])
            active_subs = db.user_subscriptions.count_documents({
                'planId': plan_id,
                'status': {'$in': ['active', 'trialing']}
            })
            total_revenue = active_subs * plan['price']
            
            row = [
                plan_id,
                plan['name'],
                plan['description'],
                plan['price'],
                plan['currency'],
                plan['interval'],
                plan['transcriptionsPerMonth'],
                plan['diskSpaceGB'],
                '; '.join(plan.get('features', [])),
                plan.get('active', True),
                plan.get('popular', False),
                plan.get('trial_days', 0),
                active_subs,
                total_revenue,
                plan['created_at'].isoformat()
            ]
            writer.writerow(row)
        
        output.seek(0)
        
        # Create response
        from flask import make_response
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv'
        response.headers['Content-Disposition'] = f'attachment; filename=subscription_plans_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
        
        return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/super-admin/subscription-plans/bulk-actions', methods=['POST'])
@jwt_required()
@super_admin_required
def bulk_actions_subscription_plans():
    """Perform bulk actions on subscription plans"""
    try:
        data = request.get_json()
        action = data.get('action')
        plan_ids = data.get('plan_ids', [])
        
        if not action or not plan_ids:
            return jsonify({'error': 'Action and plan IDs are required'}), 400
        
        if not isinstance(plan_ids, list):
            return jsonify({'error': 'Plan IDs must be an array'}), 400
        
        results = {'success': [], 'failed': []}
        
        for plan_id in plan_ids:
            try:
                plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
                if not plan:
                    results['failed'].append({'plan_id': plan_id, 'error': 'Plan not found'})
                    continue
                
                if action == 'activate':
                    db.subscription_plans.update_one(
                        {'_id': ObjectId(plan_id)},
                        {'$set': {'active': True, 'updated_at': datetime.utcnow()}}
                    )
                    # Update Stripe (only for non-trial plans)
                    if plan.get('interval') != 'trial' and plan.get('stripePriceId'):
                        stripe.Price.modify(plan['stripePriceId'], active=True)
                    
                elif action == 'deactivate':
                    db.subscription_plans.update_one(
                        {'_id': ObjectId(plan_id)},
                        {'$set': {'active': False, 'updated_at': datetime.utcnow()}}
                    )
                    # Update Stripe (only for non-trial plans)
                    if plan.get('interval') != 'trial' and plan.get('stripePriceId'):
                        stripe.Price.modify(plan['stripePriceId'], active=False)
                
                elif action == 'delete':
                    # Check for active subscriptions
                    active_subs = db.user_subscriptions.count_documents({
                        'planId': plan_id,
                        'status': {'$in': ['active', 'trialing']}
                    })
                    
                    if active_subs > 0:
                        results['failed'].append({
                            'plan_id': plan_id, 
                            'error': f'Cannot delete plan with {active_subs} active subscriptions'
                        })
                        continue
                    
                    # Soft delete
                    db.subscription_plans.update_one(
                        {'_id': ObjectId(plan_id)},
                        {'$set': {
                            'deleted': True,
                            'deleted_at': datetime.utcnow(),
                            'active': False
                        }}
                    )
                    
                elif action == 'set_popular':
                    # Remove popular flag from all plans first
                    db.subscription_plans.update_many(
                        {},
                        {'$set': {'popular': False}}
                    )
                    # Set popular for selected plans
                    db.subscription_plans.update_one(
                        {'_id': ObjectId(plan_id)},
                        {'$set': {'popular': True, 'updated_at': datetime.utcnow()}}
                    )
                
                else:
                    results['failed'].append({'plan_id': plan_id, 'error': 'Invalid action'})
                    continue
                
                results['success'].append(plan_id)
                
            except Exception as e:
                results['failed'].append({'plan_id': plan_id, 'error': str(e)})
        
        return jsonify({
            'message': f'Bulk action completed',
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/current', methods=['GET'])
@jwt_required()
def get_current_subscription():
    try:
        user_id = get_jwt_identity()
        
        # Get user's current subscription
        subscription = db.user_subscriptions.find_one({'userId': user_id})
        
        if not subscription:
            return jsonify({'subscription': None})
        
        # Get plan details
        plan = db.subscription_plans.find_one({'_id': ObjectId(subscription['planId'])})
        
        # Get usage statistics
        current_period_start = subscription.get('currentPeriodStart', datetime.utcnow().replace(day=1))
        transcriptions_used = db.consultations.count_documents({
            'doctor_id': user_id,
            'created_at': {'$gte': current_period_start}
        })
        
        # Calculate disk space used (simplified)
        total_file_size = 0
        for consultation in db.consultations.find({'doctor_id': user_id, 'audio_file_size': {'$exists': True}}):
            total_file_size += consultation.get('audio_file_size', 0)
        
        disk_space_used = round(total_file_size / (1024 * 1024 * 1024), 2)  # Convert to GB
        
        subscription_data = serialize_doc(subscription)
        subscription_data['plan'] = serialize_doc(plan)
        subscription_data['usage'] = {
            'transcriptionsUsed': transcriptions_used,
            'transcriptionsLimit': plan.get('transcriptionsPerMonth', 0) if plan else 0,
            'diskSpaceUsedGB': disk_space_used,
            'diskSpaceLimitGB': plan.get('diskSpaceGB', 0) if plan else 0
        }
        
        return jsonify({'subscription': subscription_data})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/create-checkout-session', methods=['POST'])
@jwt_required()
def create_checkout_session():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        plan_id = data.get('planId')
        
        if not plan_id:
            return jsonify({'error': 'Plan ID is required'}), 400
        
        # Get plan details
        plan = db.subscription_plans.find_one({'_id': ObjectId(plan_id)})
        if not plan:
            return jsonify({'error': 'Plan not found'}), 404
        
        # Defensive check for stripePriceId
        stripe_price_id = plan.get('stripePriceId')
        if not stripe_price_id:
            return jsonify({'error': 'Plan is not configured for Stripe payments'}), 400
        
        # Get user details
        user = db.users.find_one({'_id': ObjectId(user_id)})
        
        # Create Stripe checkout session
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': stripe_price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=request.host_url + 'subscription/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=request.host_url + 'subscription/cancel',
            customer_email=user['email'],
            metadata={
                'user_id': user_id,
                'plan_id': plan_id
            }
        )
        
        return jsonify({'sessionId': checkout_session.id})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/subscription/cancel', methods=['POST'])
@jwt_required()
def cancel_subscription():
    try:
        user_id = get_jwt_identity()
        
        subscription = db.user_subscriptions.find_one({'userId': user_id})
        if not subscription:
            return jsonify({'error': 'No active subscription found'}), 404
        
        # Cancel in Stripe
        if subscription.get('stripeSubscriptionId'):
            stripe.Subscription.modify(
                subscription['stripeSubscriptionId'],
                cancel_at_period_end=True
            )
        
        # Update in database
        db.user_subscriptions.update_one(
            {'userId': user_id},
            {'$set': {
                'cancelAtPeriodEnd': True,
                'updated_at': datetime.utcnow()
            }}
        )
        
        return jsonify({'message': 'Subscription cancelled successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Patient Routes
@app.route('/api/patients', methods=['GET'])
@jwt_required()
def get_patients():
    try:
        user_id = get_jwt_identity()
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        
        # Build query
        query = {'doctor_id': user_id}
        if search:
            query['$or'] = [
                {'first_name': {'$regex': search, '$options': 'i'}},
                {'last_name': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get patients with pagination
        skip = (page - 1) * limit
        patients = list(db.patients.find(query).skip(skip).limit(limit).sort('last_name', 1))
        total = db.patients.count_documents(query)
        
        # Add consultation count for each patient
        for patient in patients:
            patient['consultation_count'] = db.consultations.count_documents({
                'patient_id': str(patient['_id'])
            })
        
        return jsonify({
            'patients': serialize_doc(patients),
            'total': total,
            'page': page,
            'pages': (total + limit - 1) // limit
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients', methods=['POST'])
@jwt_required()
def create_patient():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'date_of_birth', 'gender']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Parse date of birth
        try:
            dob = datetime.fromisoformat(data['date_of_birth'].replace('Z', '+00:00'))
        except:
            return jsonify({'error': 'Invalid date of birth format'}), 400
        
        # Create patient with data from request
        patient_data = {
            'first_name': data['first_name'],
            'last_name': data['last_name'],
            'email': data.get('email'),
            'phone': data.get('phone'),
            'date_of_birth': dob,
            'gender': data['gender'],
            'blood_type': data.get('blood_type'),
            'address': data.get('address'),
            'emergency_contact_name': data.get('emergency_contact_name'),
            'emergency_contact_phone': data.get('emergency_contact_phone'),
            'medical_conditions': data.get('medical_conditions', []),
            'allergies': data.get('allergies', []),
            'current_medications': data.get('current_medications', []),
            'vital_signs': [],
            'notes': [],  # Initialize empty notes array
            'doctor_id': user_id,
            'status': 'new',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.patients.insert_one(patient_data)
        patient_data['_id'] = result.inserted_id
        
        return jsonify({'patient': serialize_doc(patient_data)}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients/<patient_id>', methods=['GET'])
@jwt_required()
def get_patient(patient_id):
    try:
        user_id = get_jwt_identity()
        
        patient = db.patients.find_one({
            '_id': ObjectId(patient_id),
            'doctor_id': user_id
        })
        
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        # Get patient's consultations
        consultations = list(db.consultations.find({
            'patient_id': patient_id
        }).sort('created_at', -1))
        
        patient['consultations'] = serialize_doc(consultations)
        
        return jsonify({'patient': serialize_doc(patient)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/patients/<patient_id>', methods=['PUT'])
@jwt_required()
def update_patient(patient_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Check if patient exists and belongs to user
        patient = db.patients.find_one({
            '_id': ObjectId(patient_id),
            'doctor_id': user_id
        })
        
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        # Update patient data
        update_data = {
            'updated_at': datetime.utcnow()
        }
        
        # Update allowed fields
        allowed_fields = [
            'first_name', 'last_name', 'email', 'phone', 'gender',
            'blood_type', 'address', 'emergency_contact_name', 'emergency_contact_phone',
            'medical_conditions', 'allergies', 'current_medications', 'notes'
        ]
        
        # Special handling for notes - append new note if provided
        if 'note' in data:
            # Validate note content
            note_content = data['note'].strip()
            if note_content:  # Only add non-empty notes
                new_note = {
                    'content': note_content,
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'created_by': user_id  # Track who created the note
                }
                update_data['$push'] = {'notes': new_note}
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Handle date of birth separately
        if 'date_of_birth' in data:
            try:
                update_data['date_of_birth'] = datetime.fromisoformat(
                    data['date_of_birth'].replace('Z', '+00:00')
                )
            except:
                return jsonify({'error': 'Invalid date of birth format'}), 400
        
        # Prepare update operation
        update_operation = {}
        if 'note' in data:
            # If we have a note to append, use both $set and $push
            update_operation['$push'] = update_data.pop('$push')
        if update_data:
            # Add any remaining field updates
            update_operation['$set'] = update_data

        db.patients.update_one(
            {'_id': ObjectId(patient_id)},
            update_operation
        )
        
        # Get updated patient
        updated_patient = db.patients.find_one({'_id': ObjectId(patient_id)})
        
        return jsonify({'patient': serialize_doc(updated_patient)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Consultation Routes
@app.route('/api/consultations', methods=['GET'])
@jwt_required()
def get_consultations():
    try:
        user_id = get_jwt_identity()
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        
        query = {'doctor_id': user_id}
        
        consultations = list(db.consultations.find(query).skip((page - 1) * limit).limit(limit).sort('created_at', -1))
        
        total = db.consultations.count_documents(query)
        results = []
        for consultation in consultations:
            patient = db.patients.find_one({'_id': ObjectId(consultation['patient_id'])})
            doctor = db.users.find_one({'_id': ObjectId(consultation['doctor_id'])})
            consultation['patient'] = serialize_doc(patient)
            consultation['doctor'] = serialize_doc(doctor)
            results.append(consultation)
        return jsonify({
            'consultations': serialize_doc(results),
            'pagination': {
                'total': total,
                'page': page,
                'totalPages': (total + limit - 1) // limit,
                'hasMore': page < (total + limit - 1) // limit
            }
        })
        
    except Exception as e:
        print(f"Error in get_consultations: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/consultations/<consultation_id>', methods=['DELETE'])
@jwt_required()
def delete_consultation(consultation_id):
    try:
        user_id = get_jwt_identity()
        
        # Verify consultation exists and belongs to user
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
        
        # Delete associated transcription
        db.transcriptions.delete_many({'consultation_id': consultation_id})
        
        # Delete associated reports
        db.reports.delete_many({'consultation_id': consultation_id})
        
        # Delete audio file if exists
        if 'audio_file_path' in consultation:
            try:
                os.remove(consultation['audio_file_path'])
            except OSError:
                pass  # Ignore file deletion errors
        
        # Delete consultation
        db.consultations.delete_one({'_id': ObjectId(consultation_id)})
        
        return jsonify({'message': 'Consultation deleted successfully'})
        
    except Exception as e:
        print(f"Error in delete_consultation: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/consultations/<consultation_id>', methods=['PUT'])
@jwt_required()
def update_consultation(consultation_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Check if consultation exists and belongs to user
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
        
        # Update consultation data
        update_data = {
            'updated_at': datetime.utcnow()
        }
        
        # Update allowed fields
        allowed_fields = [
            'consultation_type', 'recording_type', 'consent_obtained', 'consent_timestamp',
            'status', 'scheduled_at', 'notes', 'metadata'
        ]
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        db.consultations.update_one(
            {'_id': ObjectId(consultation_id)},
            {'$set': update_data}
        )
        
        # Get updated consultation
        updated_consultation = db.consultations.find_one({'_id': ObjectId(consultation_id)})
        
        return jsonify({'consultation': serialize_doc(updated_consultation)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/consultations', methods=['POST'])
@jwt_required()
def create_consultation():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['patient_id', 'consultation_type', 'recording_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Verify patient belongs to user
        patient = db.patients.find_one({
            '_id': ObjectId(data['patient_id']),
            'doctor_id': user_id
        })
        
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
        
        # Create consultation
        consultation_data = {
            'patient_id': data['patient_id'],
            'doctor_id': user_id,
            'consultation_type': data['consultation_type'],
            'recording_type': data['recording_type'],
            'consent_obtained': data.get('consent_obtained', False),
            'consent_timestamp': datetime.utcnow() if data.get('consent_obtained') else None,
            'status': 'scheduled',
            'scheduled_at': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'notes': data.get('notes', ''),
            'metadata': data.get('metadata', {})
        }
        
        result = db.consultations.insert_one(consultation_data)
        consultation_data['_id'] = result.inserted_id
        
        # Update patient's last visit and status
        db.patients.update_one(
            {'_id': ObjectId(data['patient_id'])},
            {
                '$set': {
                    'last_visit': datetime.utcnow(),
                    'status': 'active',
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return jsonify({'consultation': serialize_doc(consultation_data)}), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/consultations/<consultation_id>/start', methods=['POST'])
@jwt_required()
def start_consultation(consultation_id):
    try:
        user_id = get_jwt_identity()
        
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
        
        # Update consultation status
        db.consultations.update_one(
            {'_id': ObjectId(consultation_id)},
            {
                '$set': {
                    'status': 'in_progress',
                    'started_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Emit real-time update
        socketio.emit('consultation_started', {
            'consultation_id': consultation_id,
            'status': 'in_progress'
        }, room=f'user-{user_id}')
        
        return jsonify({'message': 'Consultation started successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/consultations/<consultation_id>/end', methods=['POST'])
@jwt_required()
def end_consultation(consultation_id):
    try:
        user_id = get_jwt_identity()
        
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
        
        # Update consultation status
        db.consultations.update_one(
            {'_id': ObjectId(consultation_id)},
            {
                '$set': {
                    'status': 'recorded',
                    'ended_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Emit real-time update
        socketio.emit('consultation_ended', {
            'consultation_id': consultation_id,
            'status': 'recorded'
        }, room=f'user-{user_id}')
        
        return jsonify({'message': 'Consultation ended successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Audio Upload and Transcription Routes
@app.route('/api/consultations/<consultation_id>/upload-audio', methods=['POST'])
@jwt_required()
def upload_audio(consultation_id):
    try:
        user_id = get_jwt_identity()

        # Validate consultation_id
        if not consultation_id or consultation_id == 'undefined':
            return jsonify({'error': 'Invalid consultation ID'}), 400
            
        # Validate ObjectId format
        try:
            consultation_id_obj = ObjectId(consultation_id)
        except:
            return jsonify({'error': 'Invalid consultation ID format'}), 400
        
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({
                'error': 'Invalid file format. Supported formats: WAV, MP3, M4A, FLAC, OGG, WEBM'
            }), 400
        
        # Check file size before saving (1GB limit)
        file.seek(0, 2)  # Seek to end of file
        file_size = file.tell()
        file.seek(0)  # Reset file pointer
        
        max_size = 1024 * 1024 * 1024  # 1GB
        if file_size > max_size:
            return jsonify({
                'error': f'File too large. Maximum size allowed: {max_size // (1024 * 1024)}MB. Your file: {file_size // (1024 * 1024)}MB'
            }), 413
        
        if file_size < 1024:  # Less than 1KB
            return jsonify({'error': 'File too small. Minimum size: 1KB'}), 400
        
        # Verify consultation belongs to user
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
        
        # Check user subscription limits
        user = db.users.find_one({'_id': ObjectId(user_id)})
        if user and user.get('role') == 'doctor':
            # Get user's active subscription
            subscription = db.user_subscriptions.find_one({
                'userId': user_id,
                'status': {'$in': ['active', 'trialing']}
            })
            
            if subscription:
                plan = db.subscription_plans.find_one({'_id': ObjectId(subscription['planId'])})
                if plan:
                    # Check transcription limit
                    current_month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                    transcriptions_this_month = db.transcriptions.count_documents({
                        'doctor_id': user_id,
                        'created_at': {'$gte': current_month_start}
                    })
                    
                    if transcriptions_this_month >= plan.get('transcriptionsPerMonth', 0):
                        return jsonify({
                            'error': f'Monthly transcription limit reached ({plan.get("transcriptionsPerMonth", 0)}). Please upgrade your plan or wait for next month.'
                        }), 429
                    
                    # Check storage limit
                    user_consultations = list(db.consultations.find({'doctor_id': user_id}))
                    total_file_size = 0
                    for consult in user_consultations:
                        total_file_size += consult.get('audio_file_size', 0)
                    
                    # Add current file size
                    total_file_size += file_size
                    disk_space_used = total_file_size / (1024 * 1024 * 1024)  # Convert to GB
                    
                    if disk_space_used > plan.get('diskSpaceGB', 0):
                        return jsonify({
                            'error': f'Storage limit exceeded. Used: {disk_space_used:.2f}GB, Limit: {plan.get("diskSpaceGB", 0)}GB. Please upgrade your plan or delete some files.'
                        }), 429
        
        # Ensure upload directory exists
        upload_dir = 'uploads/audio'
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save audio file with secure filename
        filename = secure_filename(f"{consultation_id}_{uuid.uuid4().hex}.{file.filename.rsplit('.', 1)[1].lower()}")
        file_path = os.path.join(upload_dir, filename)
        
        # Save file in chunks to handle large files better
        try:
            with open(file_path, 'wb') as f:
                while True:
                    chunk = file.stream.read(8192)  # 8KB chunks
                    if not chunk:
                        break
                    f.write(chunk)
        except Exception as e:
            # Clean up partial file if save failed
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
        
        # Verify file was saved correctly
        saved_file_size = os.path.getsize(file_path)
        if saved_file_size != file_size:
            os.remove(file_path)
            return jsonify({'error': 'File upload corrupted. Please try again.'}), 500
        
        # Update consultation with audio info
        db.consultations.update_one(
            {'_id': ObjectId(consultation_id)},
            {
                '$set': {
                    'audio_file_path': file_path,
                    'audio_file_size': saved_file_size,
                    'audio_format': file.filename.rsplit('.', 1)[1].lower(),
                    'status': 'recorded',
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        # Start transcription process
        transcription_id = start_transcription(consultation_id, file_path, user_id)
        
        return jsonify({
            'success': True,
            'message': 'Audio uploaded successfully',
            'transcription_id': transcription_id,
            'file_size': saved_file_size,
            'file_format': file.filename.rsplit('.', 1)[1].lower()
        })
        
    except Exception as e:
        # Log the error for debugging
        print(f"Upload error: {str(e)}")
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/api/consultations/<consultation_id>/validate-upload', methods=['POST'])
@jwt_required()
def validate_upload(consultation_id):
    """Validate file before upload to provide early feedback"""
    try:
        user_id = get_jwt_identity()
        
        # Validate consultation_id
        if not consultation_id or consultation_id == 'undefined':
            return jsonify({'error': 'Invalid consultation ID'}), 400
            
        try:
            consultation_id_obj = ObjectId(consultation_id)
        except:
            return jsonify({'error': 'Invalid consultation ID format'}), 400
        
        # Check if consultation exists and belongs to user
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
        
        # Get file info from request
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No file information provided'}), 400
        
        filename = data.get('filename', '')
        file_size = data.get('file_size', 0)
        
        if not filename:
            return jsonify({'error': 'Filename is required'}), 400
        
        if not file_size:
            return jsonify({'error': 'File size is required'}), 400
        
        # Validate file format
        if not allowed_file(filename):
            return jsonify({
                'error': 'Invalid file format',
                'message': 'Supported formats: WAV, MP3, M4A, FLAC, OGG, WEBM',
                'supported_formats': ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm']
            }), 400
        
        # Validate file size
        max_size = 1024 * 1024 * 1024  # 1GB (increased for large files)
        min_size = 1024  # 1KB
        
        if file_size > max_size:
            return jsonify({
                'error': 'File too large',
                'message': f'Maximum size allowed: {max_size // (1024 * 1024)}MB. Your file: {file_size // (1024 * 1024)}MB',
                'max_size_bytes': max_size,
                'file_size_bytes': file_size
            }), 413
        
        if file_size < min_size:
            return jsonify({
                'error': 'File too small',
                'message': f'Minimum size required: {min_size} bytes. Your file: {file_size} bytes',
                'min_size_bytes': min_size
            }), 400
        
        return jsonify({
            'success': True,
            'message': 'File validation passed',
            'file_info': {
                'filename': filename,
                'size_bytes': file_size,
                'size_mb': round(file_size / (1024 * 1024), 2),
                'format': filename.rsplit('.', 1)[1].lower() if '.' in filename else 'unknown'
            },
            'limits': {
                'max_size_mb': max_size // (1024 * 1024),
                'min_size_kb': min_size // 1024,
                'supported_formats': ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm']
            }
        })
        
    except Exception as e:
        return jsonify({'error': f'Validation failed: {str(e)}'}), 500

@app.route('/api/upload/limits', methods=['GET'])
def get_upload_limits():
    """Get upload limits and supported formats"""
    max_size = 1024 * 1024 * 1024  # 1GB (increased for large files)
    min_size = 1024  # 1KB
    
    return jsonify({
        'limits': {
            'max_size_bytes': max_size,
            'max_size_mb': max_size // (1024 * 1024),
            'min_size_bytes': min_size,
            'min_size_kb': min_size // 1024,
            'supported_formats': ['wav', 'mp3', 'm4a', 'flac', 'ogg', 'webm'],
            'recommended_formats': ['wav', 'mp3', 'm4a']
        },
        'recommendations': {
            'optimal_bitrate': '128-320 kbps for MP3',
            'sample_rate': '44.1 kHz or 48 kHz',
            'channels': 'Mono or Stereo',
            'duration_limit': 'No specific limit - large files are automatically split and processed',
            'large_file_handling': 'Files over 25MB are automatically split into 10-minute chunks for optimal processing'
        },
        'processing': {
            'chunk_duration_seconds': CHUNK_DURATION_SECONDS,
            'overlap_seconds': OVERLAP_SECONDS,
            'max_chunk_size_mb': MAX_FILE_SIZE_BYTES // (1024 * 1024)
        }
    })

def start_transcription(consultation_id, audio_file_path, user_id):
    """Start the transcription process"""
    try:
        # Create transcription record
        transcription_data = {
            'consultation_id': consultation_id,
            'doctor_id': user_id,
            'audio_file_path': audio_file_path,
            'status': 'processing',
            'language': 'es',
            'model_used': 'whisper-1',
            'started_at': datetime.utcnow(),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.transcriptions.insert_one(transcription_data)
        transcription_id = str(result.inserted_id)
        
        # Check file size to determine processing method
        file_size = os.path.getsize(audio_file_path)
        
        if file_size > MAX_FILE_SIZE_BYTES:
            print(f"Large file detected ({file_size / (1024*1024):.2f}MB), using chunked processing")
            # Use chunked processing for large files
            process_large_transcription(transcription_id, audio_file_path, user_id)
        else:
            print(f"Standard file size ({file_size / (1024*1024):.2f}MB), using normal processing")
            # Use normal processing for standard files
            process_transcription(transcription_id, audio_file_path)
        
        return transcription_id
        
    except Exception as e:
        print(f"Error starting transcription: {e}")
        return None

def analyze_conversation_with_gpt(segments):
    """
    Analyze the transcribed segments using OpenAI GPT to structure the conversation
    and identify key medical information.
    """
    try:
        if not segments:
            return {
                "conversation_flow": [],
                "medical_info": {
                    "symptoms": [],
                    "medical_history": [],
                    "current_medications": [],
                    "diagnosis": [],
                    "treatment_plan": [],
                    "follow_up": []
                },
                "summary": "No transcription segments available"
            }

        system_prompt = """You are a medical conversation analyzer. Given a medical consultation transcription segments:
        1. Identify and separate speakers (Doctor and Patient) for each segment
        2. Structure the conversation into clear turns with timing information
        3. Identify key medical information:
           - Symptoms
           - Medical history mentioned
           - Current medications
           - Diagnosis discussions
           - Treatment plans
           - Follow-up instructions
        4. Maintain the original Spanish text but provide structured output

        Each segment will have:
        - text: The transcribed text
        - start: Start time in seconds
        - end: End time in seconds
        - confidence: Confidence score of transcription

        Format the response as a JSON object with the following structure:
        {
            "conversation_flow": [
                {
                    "speaker": "doctor/patient",
                    "text": "...",
                    "start": float,
                    "end": float,
                    "confidence": float
                }
            ],
            "medical_info": {
                "symptoms": [],
                "medical_history": [],
                "current_medications": [],
                "diagnosis": [],
                "treatment_plan": [],
                "follow_up": []
            },
            "summary": "brief_summary_of_consultation"
        }
        Don't mention about texts like "```json```", only return JSON.
        """

        # Format segments for GPT
        formatted_segments = []
        for s in segments:
            try:
                # Print segment for debugging
                print(f"Processing segment: {s}")
                
                # Safely handle potential None values
                start_val = s.get("start")
                end_val = s.get("end")
                
                # Convert to float with safe defaults
                start_float = 0.0
                end_float = 0.0
                
                if start_val is not None:
                    try:
                        start_float = float(start_val)
                    except (ValueError, TypeError):
                        start_float = 0.0
                        print(f"Warning: Invalid start value '{start_val}', using 0.0")
                
                if end_val is not None:
                    try:
                        end_float = float(end_val)
                    except (ValueError, TypeError):
                        end_float = 0.0
                        print(f"Warning: Invalid end value '{end_val}', using 0.0")
                
                formatted_segment = {
                    "text": str(s.get("text", "")),
                    "start": start_float,
                    "end": end_float,
                }
                formatted_segments.append(formatted_segment)
            except Exception as e:
                print(f"Error formatting segment: {e}")
                print(f"Problematic segment: {s}")
                # Add segment with safe defaults
                formatted_segments.append({
                    "text": str(s.get("text", "")),
                    "start": 0.0,
                    "end": 0.0,
                })
                continue

        if not formatted_segments:
            print("Warning: No valid segments to analyze, creating default structure")
            return {
                "conversation_flow": [],
                "medical_info": {
                    "symptoms": [],
                    "medical_history": [],
                    "current_medications": [],
                    "diagnosis": [],
                    "treatment_plan": [],
                    "follow_up": []
                },
                "summary": "No transcription segments available for analysis"
            }

        segments_text = json.dumps(formatted_segments, ensure_ascii=False, indent=2)
        
        user_prompt = f"Please analyze these medical consultation segments:\n\n{segments_text}"

        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
            )

            # Print raw GPT response for debugging
            print(f"Raw GPT response: {response.choices[0].message.content}")

            # Parse and validate the response
            analysis = json.loads(response.choices[0].message.content)
            
            # Ensure all required fields are present
            required_fields = ["conversation_flow", "medical_info", "summary"]
            for field in required_fields:
                if field not in analysis:
                    analysis[field] = [] if field == "conversation_flow" else {}
            
            # Ensure medical_info has all required fields
            required_medical_fields = [
                "symptoms", "medical_history", "current_medications",
                "diagnosis", "treatment_plan", "follow_up"
            ]
            if "medical_info" not in analysis:
                analysis["medical_info"] = {}
            
            for field in required_medical_fields:
                if field not in analysis["medical_info"]:
                    analysis["medical_info"][field] = []

            # Validate conversation_flow structure
            if "conversation_flow" in analysis:
                validated_flow = []
                for item in analysis["conversation_flow"]:
                    try:
                        # Handle None values and provide safe defaults
                        start_val = item.get("start")
                        end_val = item.get("end")
                        confidence_val = item.get("confidence")
                        
                        # Convert to float with safe defaults, handle None values
                        start_float = 0.0
                        end_float = 0.0
                        confidence_float = 0.0
                        
                        if start_val is not None:
                            try:
                                start_float = float(start_val)
                            except (ValueError, TypeError):
                                start_float = 0.0
                        
                        if end_val is not None:
                            try:
                                end_float = float(end_val)
                            except (ValueError, TypeError):
                                end_float = 0.0
                        
                        if confidence_val is not None:
                            try:
                                confidence_float = float(confidence_val)
                            except (ValueError, TypeError):
                                confidence_float = 0.0
                        
                        validated_item = {
                            "speaker": str(item.get("speaker", "unknown")),
                            "text": str(item.get("text", "")),
                            "start": start_float,
                            "end": end_float,
                            "confidence": confidence_float
                        }
                        validated_flow.append(validated_item)
                    except Exception as e:
                        print(f"Error validating conversation flow item: {e}")
                        print(f"Problematic item: {item}")
                        continue
                analysis["conversation_flow"] = validated_flow

            return analysis

        except json.JSONDecodeError as e:
            print(f"Error decoding GPT response: {e}")
            # Return a default structure if JSON parsing fails
            default_flow = []
            for s in formatted_segments:
                try:
                    # Safely handle potential None values
                    start_val = s.get("start", 0)
                    end_val = s.get("end", 0)
                    confidence_val = s.get("avg_logprob", 0)
                    
                    # Convert to float safely
                    start_float = 0.0 if start_val is None else float(start_val)
                    end_float = 0.0 if end_val is None else float(end_val)
                    confidence_float = 0.0 if confidence_val is None else float(confidence_val)
                    
                    default_flow.append({
                        "speaker": "unknown", 
                        "text": str(s.get("text", "")), 
                        "start": start_float, 
                        "end": end_float, 
                        "confidence": confidence_float
                    })
                except (ValueError, TypeError) as conv_e:
                    print(f"Error creating default flow item: {conv_e}")
                    # Add item with safe defaults
                    default_flow.append({
                        "speaker": "unknown",
                        "text": str(s.get("text", "")),
                        "start": 0.0,
                        "end": 0.0,
                        "confidence": 0.0
                    })
            
            return {
                "conversation_flow": default_flow,
                "medical_info": {
                    "symptoms": [],
                    "medical_history": [],
                    "current_medications": [],
                    "diagnosis": [],
                    "treatment_plan": [],
                    "follow_up": []
                },
                "summary": "Error analyzing conversation"
            }

    except Exception as e:
        print(f"Error analyzing conversation with GPT: {e}")
        print(f"Full error details: {str(e)}")
        # Return a minimal valid structure
        return {
            "conversation_flow": [],
            "medical_info": {
                "symptoms": [],
                "medical_history": [],
                "current_medications": [],
                "diagnosis": [],
                "treatment_plan": [],
                "follow_up": []
            },
            "summary": f"Error analyzing conversation: {str(e)}"
        }

def process_large_transcription(transcription_id, audio_file_path, user_id):
    """Process large audio files using chunked transcription approach"""
    try:
        print(f"\nProcessing large transcription for file: {audio_file_path}")
        
        # Get file information for logging
        file_info = get_file_info(audio_file_path)
        print(f"File exists: {file_info['exists']}")
        print(f"File size: {file_info['size']} bytes")
        print(f"MIME type: {file_info['mime_type']}")

        # Start chunked transcription process
        print("\nStarting chunked transcription process...")
        transcription_result = process_large_audio_transcription(audio_file_path, user_id)

        if not transcription_result or transcription_result.get('status') == 'error':
            error_message = transcription_result.get('error', 'Unknown transcription error') if transcription_result else 'Transcription failed'
            raise Exception(error_message)

        # Extract the full text and segments from the transcription result
        transcription_text = transcription_result['full_text']
        segments = transcription_result['segments']

        # Analyze transcription with GPT using segments
        print("\nAnalyzing transcription with GPT...")
        analysis = analyze_conversation_with_gpt(segments)

        if not analysis:
            raise Exception("Conversation analysis failed")

        # Update segments with speaker information from GPT analysis
        conversation_flow = analysis.get('conversation_flow', [])
        for i, segment in enumerate(segments):
            if i < len(conversation_flow):
                segments[i]['speaker'] = conversation_flow[i]['speaker'].lower()

        # Calculate overall confidence score from segments
        confidence_scores = [segment.get('confidence', 0) for segment in segments]
        confidence_score = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0

        # Update transcription with results
        db.transcriptions.update_one(
            {'_id': ObjectId(transcription_id)},
            {
                '$set': {
                    'raw_text': transcription_text,
                    'segments': segments,
                    'confidence_score': confidence_score,
                    'duration': transcription_result['duration'],
                    'language': transcription_result['language'],
                    'processing_time': 0,
                    'status': 'completed',
                    'completed_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'analysis': {
                        'medical_info': analysis['medical_info'],
                        'summary': analysis['summary']
                    },
                    'processing_method': 'chunked',
                    'chunk_count': transcription_result.get('chunk_count', 1)
                }
            }
        )

        # Get transcription to update consultation
        transcription = db.transcriptions.find_one({'_id': ObjectId(transcription_id)})

        if transcription:
            # Update consultation with medical information
            db.consultations.update_one(
                {'_id': ObjectId(transcription['consultation_id'])},
                {
                    '$set': {
                        'status': 'transcribed',
                        'updated_at': datetime.utcnow(),
                        'audio_duration': transcription_result['duration'],
                        'language_detected': transcription_result['language'],
                        'medical_info': analysis['medical_info'],
                        'consultation_summary': analysis['summary']
                    }
                }
            )

            # Emit real-time update
            socketio.emit('transcription_completed', {
                'transcription_id': transcription_id,
                'consultation_id': transcription['consultation_id'],
                'status': 'completed',
                'duration': transcription_result['duration'],
                'language': transcription_result['language'],
                'confidence_score': confidence_score,
                'summary': analysis['summary'],
                'processing_method': 'chunked',
                'chunk_count': transcription_result.get('chunk_count', 1)
            }, room=f'user-{transcription["doctor_id"]}')

    except Exception as e:
        print(f"Error processing large transcription: {e}")
        # Update transcription with error
        db.transcriptions.update_one(
            {'_id': ObjectId(transcription_id)},
            {
                '$set': {
                    'status': 'failed',
                    'error_message': str(e),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        # Emit error event
        transcription = db.transcriptions.find_one({'_id': ObjectId(transcription_id)})
        if transcription_id:
            socketio.emit('transcription_error', {
                'transcription_id': transcription_id,
                'error': str(e)
            }, room=f'user-{user_id}')

def process_transcription(transcription_id, audio_file_path):
    """Process the audio transcription using OpenAI Whisper and analyze with GPT"""
    try:
        # Get file information for logging
        file_info = get_file_info(audio_file_path)
        print(f"\nProcessing transcription for file:")
        print(f"File exists: {file_info['exists']}")
        print(f"File_size: {file_info['size']} bytes")
        print(f"MIME type: {file_info['mime_type']}")

        # Start transcription
        print("\nStarting transcription process...")
        transcription_result = transcribe_audio(audio_file_path)

        if not transcription_result or transcription_result.get('status') == 'error':
            error_message = transcription_result.get('error', 'Unknown transcription error') if transcription_result else 'Transcription failed'
            raise Exception(error_message)

        # Extract the full text and segments from the transcription result
        transcription_text = transcription_result['full_text']
        segments = transcription_result['segments']

        # Analyze transcription with GPT using segments
        print("\nAnalyzing transcription with GPT...")
        analysis = analyze_conversation_with_gpt(segments)

        if not analysis:
            raise Exception("Conversation analysis failed")

        # Update segments with speaker information from GPT analysis
        conversation_flow = analysis.get('conversation_flow', [])
        for i, segment in enumerate(segments):
            if i < len(conversation_flow):
                segments[i]['speaker'] = conversation_flow[i]['speaker'].lower()

        # Calculate overall confidence score from segments
        confidence_scores = [segment.get('confidence', 0) for segment in segments]
        confidence_score = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0

        # Update transcription with results
        db.transcriptions.update_one(
            {'_id': ObjectId(transcription_id)},
            {
                '$set': {
                    'raw_text': transcription_text,
                    'segments': segments,
                    'confidence_score': confidence_score,
                    'duration': transcription_result['duration'],
                    'language': transcription_result['language'],
                    'processing_time': 0,
                    'status': 'completed',
                    'completed_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'analysis': {
                        'medical_info': analysis['medical_info'],
                        'summary': analysis['summary']
                    },
                    'processing_method': 'standard'
                }
            }
        )

        # Get transcription to update consultation
        transcription = db.transcriptions.find_one({'_id': ObjectId(transcription_id)})

        if transcription:
            # Update consultation with medical information
            db.consultations.update_one(
                {'_id': ObjectId(transcription['consultation_id'])},
                {
                    '$set': {
                        'status': 'transcribed',
                        'updated_at': datetime.utcnow(),
                        'audio_duration': transcription_result['duration'],
                        'language_detected': transcription_result['language'],
                        'medical_info': analysis['medical_info'],
                        'consultation_summary': analysis['summary']
                    }
                }
            )

            # Emit real-time update
            socketio.emit('transcription_completed', {
                'transcription_id': transcription_id,
                'consultation_id': transcription['consultation_id'],
                'status': 'completed',
                'duration': transcription_result['duration'],
                'language': transcription_result['language'],
                'confidence_score': confidence_score,
                'summary': analysis['summary'],
                'processing_method': 'standard'
            }, room=f'user-{transcription["doctor_id"]}')

    except Exception as e:
        print(f"Error processing transcription: {e}")
        # Update transcription with error
        db.transcriptions.update_one(
            {'_id': ObjectId(transcription_id)},
            {
                '$set': {
                    'status': 'failed',
                    'error_message': str(e),
                    'updated_at': datetime.utcnow()
                }
            }
        )
        # Emit error event
        transcription = db.transcriptions.find_one({'_id': ObjectId(transcription_id)})
        if transcription:
            socketio.emit('transcription_error', {
                'transcription_id': transcription_id,
                'consultation_id': transcription['consultation_id'],
                'error': str(e)
            }, room=f'user-{transcription["doctor_id"]}')

@app.route('/api/consultations/transcriptions/<consultation_id>', methods=['GET'])
@jwt_required()
def get_consultation_transcription(consultation_id):
    try:
        user_id = get_jwt_identity()
        
        result = db.transcriptions.find_one({'consultation_id': consultation_id, 'doctor_id': user_id})        
        if not result:
            return jsonify({'error': 'Transcription not found'}), 404
        
        return jsonify({    
            'transcription': serialize_doc(result)
        })
        
    except Exception as e:
        print(f"Error in get_consultation_transcription: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/consultations/transcriptions/<consultation_id>/segments/<int:segment_id>', methods=['PATCH'])
@jwt_required()
def update_transcription_segment(consultation_id, segment_id):
    """Update a specific segment in a transcription"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if 'text' not in data:
            return jsonify({'error': 'Text is required'}), 400
            
        # Find the transcription
        transcription = db.transcriptions.find_one({
            'consultation_id': consultation_id
        })
        
        if not transcription:
            return jsonify({'error': 'Transcription not found'}), 404
            
        # Update the specific segment
        result = db.transcriptions.update_one(
            {
                'consultation_id': consultation_id,
                'segments.id': segment_id
            },
            {
                '$set': {
                    'segments.$.text': data['text'],
                    'segments.$.updated_at': datetime.utcnow(),
                    'segments.$.updated_by': ObjectId(user_id)
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Segment not found or no changes made'}), 404
            
        # Log the edit
        db.segment_edit_history.insert_one({
            'transcription_id': transcription['_id'],
            'consultation_id': consultation_id,
            'segment_id': segment_id,
            'previous_text': next((s['text'] for s in transcription['segments'] if s['id'] == segment_id), None),
            'new_text': data['text'],
            'edited_by': ObjectId(user_id),
            'edited_at': datetime.utcnow()
        })
        
        return jsonify({'message': 'Segment updated successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/consultations/transcriptions/<consultation_id>/status', methods=['GET'])
@jwt_required()
def get_transcription_status(consultation_id):
    """Get the current status and processing information for a transcription"""
    try:
        user_id = get_jwt_identity()
        
        transcription = db.transcriptions.find_one({
            'consultation_id': consultation_id,
            'doctor_id': user_id
        })
        
        if not transcription:
            return jsonify({'error': 'Transcription not found'}), 404
        
        status_info = {
            'status': transcription.get('status', 'unknown'),
            'processing_method': transcription.get('processing_method', 'standard'),
            'chunk_count': transcription.get('chunk_count', 1),
            'started_at': transcription.get('started_at'),
            'completed_at': transcription.get('completed_at'),
            'error_message': transcription.get('error_message'),
            'progress': 'unknown'
        }
        
        # Calculate progress for chunked processing
        if transcription.get('processing_method') == 'chunked' and transcription.get('status') == 'processing':
            # This would be updated in real-time during processing
            status_info['progress'] = 'processing_chunks'
            status_info['estimated_completion'] = 'Processing large file in chunks...'
        
        return jsonify({'transcription_status': status_info})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Report Generation Routes
@app.route('/api/consultations/<consultation_id>/report', methods=['POST'])
@jwt_required()
def generate_consultation_report(consultation_id):
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        options = data.get('options', {})
        
        # Get consultation data
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
            
        # Get patient data
        patient = db.patients.find_one({'_id': ObjectId(consultation['patient_id'])})
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
            
        # Get transcription data
        transcription = db.transcriptions.find_one({
            'consultation_id': consultation_id,
            'doctor_id': user_id
        })
        
        if not transcription:
            return jsonify({'error': 'Transcription not found'}), 404
        
        doctor = db.users.find_one({'_id': ObjectId(user_id)})
        # Generate AI report content
        report_content = generate_ai_report(transcription, consultation, patient, options, doctor)
        
        # Generate unique filename for the PDF
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_filename = f"consultation_report_{consultation_id}_{timestamp}.pdf"
        pdf_filepath = os.path.join('uploads', 'reports', pdf_filename)
        
        # Create report record
        report_data = {
            'consultation_id': consultation_id,
            'patient_id': consultation['patient_id'],
            'doctor_id': user_id,
            'content': report_content,
            'options': options,
            'format': options.get('format', 'SOAP'),
            'generated_by': data.get('generatedBy', 'System'),
            'status': 'generated',
            'file_path': pdf_filepath,  # Add file path to report data
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.reports.insert_one(report_data)
        report_data['_id'] = result.inserted_id
        
        # Generate PDF and save to file
        pdf_buffer = generate_enhanced_pdf(report_data, patient, consultation)
        
        with open(pdf_filepath, 'wb') as pdf_file:
            pdf_file.write(pdf_buffer.getvalue())

        return send_file(
            io.BytesIO(pdf_buffer.getvalue()),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'consultation-report-{consultation_id}-{datetime.now().strftime("%Y%m%d")}.pdf'
        )
        
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        return jsonify({'error': str(e)}), 500

def generate_ai_report(transcription, consultation, patient, options, doctor):
    """Generate medical report using GPT-4"""
    try:
        # Prepare patient info
        patient_name = f"{patient['first_name']} {patient['last_name']}"
        patient_age = calculate_age(patient['date_of_birth'])
        gender = patient.get('gender', 'No especificado')
        doctor_name = f"{doctor['full_name']}"
        
        # Get transcription text and analysis
        text = transcription.get('raw_text', '')
        analysis = transcription.get('analysis', {})
        medical_info = analysis.get('medical_info', {})
        
        # Prepare prompt for GPT
        system_prompt = """You are an expert medical doctor specializing in creating detailed medical reports.
        Your task is to generate a professional medical report in SOAP format based on the consultation transcription and patient information provided.
        
        Please ensure:
        1. Professional medical terminology
        2. Clear structure following the SOAP format
        3. Comprehensive coverage of all medical findings
        4. Appropriate medical recommendations
        5. Clear follow-up instructions
        
        The report MUST include these sections with their exact HTML tags:
        - <b>S - Subjetivo:</b> (Patient's symptoms, complaints, and history)
        - <b>O - Objetivo:</b> (Physical examination findings and objective data)
        - <b>A - Evaluación:</b> (Assessment and diagnosis)
        - <b>P - Plan:</b> (Treatment plan and recommendations)
        - <b>Signos Vitales:</b> (Vital signs if available)
        - <b>Examen Neurológico:</b> (Neurological examination if relevant)
        - <b>Tratamiento Farmacológico:</b> (Prescribed medications)
        - <b>Medidas de Autocuidado:</b> (Self-care instructions)
        - <b>Recomendaciones Dietéticas:</b> (Dietary recommendations if applicable)
        - <b>Seguimiento:</b> (Follow-up instructions)
        
        Format the report maintaining proper medical documentation standards.
        Use Spanish language for the report.
        Do not use markdown formatting (no ** or --- or _).
        Use only these HTML tags for formatting:
        - <b> for section headers exactly as shown above
        - <hr> for horizontal lines
        - <u> for underlined text
        
        Each section MUST start with its exact HTML tag as shown above.
        """

        consultation_prompt = f"""
        Patient Information:
        - Name: {patient_name}
        - Age: {patient_age}
        - Gender: {gender}
        Doctor Name: {doctor_name} 
        Doctor Contact: {doctor['email']}
        
        Consultation Transcription:
        {text}
        
        Medical Information from Analysis:
        - Symptoms: {', '.join(medical_info.get('symptoms', []))}
        - Diagnosis: {', '.join(medical_info.get('diagnosis', []))}
        - Treatment Plan: {', '.join(medical_info.get('treatment_plan', []))}
        
        Date: {consultation['created_at'].strftime('%d/%m/%Y %H:%M')}
        For Physician's Signature, please use correct information.
        Please generate a {options.get('format', 'SOAP')} format medical report.
        Include all relevant medical information, recommendations, and follow-up instructions.
        Format the report with proper HTML tags instead of markdown.
        """

        # Call GPT-4 for report generation
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": consultation_prompt}
            ]
        )

        report_content = response.choices[0].message.content

        # Process the content to ensure proper formatting
        report_content = process_report_formatting(report_content, doctor)
        
        return report_content

    except Exception as e:
        print(f"Error generating AI report: {str(e)}")
        return "Error generating report content"

def process_report_formatting(content, doctor):
    """Process and clean up report formatting"""
    # Remove markdown formatting
    content = content.replace('**', '')
    content = content.replace('---', '<hr>')
    content = content.replace('_', '')
    content = content.replace('<br>', '\n')  # Replace <br> with newline
    
    # Add HTML formatting for sections
    sections = ['REPORTE MÉDICO', 'S - Subjetivo:', 'O - Objetivo:', 'A - Evaluación:', 'P - Plan:', 
               'Signos Vitales:', 'Examen Neurológico:', 'Tratamiento Farmacológico:', 
               'Medidas de Autocuidado:', 'Recomendaciones Dietéticas:', 'Seguimiento:',
               'Firma del Médico:', 'Nota:']
    
    for section in sections:
        content = content.replace(section, f'<b>{section}</b>')
    
    # Format patient info section
    info_fields = ['Paciente:', 'Edad:', 'Género:', 'Fecha de consulta:', 'Hora:', 'Médico:', 'Contacto Médico:']
    for field in info_fields:
        content = content.replace(field, f'<b>{field}</b>')
    
    # Clean up any double newlines and spaces
    content = re.sub(r'\n\s*\n', '\n\n', content)
    content = re.sub(r' +', ' ', content)
    
    # Add 4 lines of space before the signature section
    # Find the last content before signature and add spacing
    content = re.sub(r'(\n\n)(?=.*?<b>Firma del Médico:</b>)', r'\n\n\n\n\n\n', content, flags=re.DOTALL)
    
    # Ensure there's proper spacing after the last content before signature
    # Look for common ending patterns and add spacing
    ending_patterns = [
        r'(Seguimiento:.*?)(\n\n)(?=<b>Firma del Médico:</b>)',
        r'(Recomendaciones Dietéticas:.*?)(\n\n)(?=<b>Firma del Médico:</b>)',
        r'(Tratamiento Farmacológico:.*?)(\n\n)(?=<b>Firma del Médico:</b>)'
    ]
    
    for pattern in ending_patterns:
        content = re.sub(pattern, r'\1\n\n\n\n\n\n', content, flags=re.DOTALL)
    
    # Ensure proper signature formatting with complete doctor information
    doctor_name = doctor.get('full_name', '')
    doctor_email = doctor.get('email', '')
    doctor_phone = doctor.get('phone', '')
    doctor_role = doctor.get('role', 'doctor')
    
    signature_block = f"""
<b>Firma del Médico:</b>

Dr. {doctor_name}
{doctor_role.title()}
Email: {doctor_email}
Teléfono: {doctor_phone if doctor_phone else 'No especificado'}

Fecha: {datetime.now().strftime('%d/%m/%Y')}
Hora: {datetime.now().strftime('%H:%M')}

<hr>
"""
    # Replace existing signature block with properly formatted one
    content = re.sub(r'<b>Firma del Médico:</b>.*?(?=\n\n|$)', signature_block, content, flags=re.DOTALL)
    
    # Add final generated by line
    content += f"\nGenerated by: Dr. {doctor_name}"
    
    return content

def generate_enhanced_pdf(report, patient, consultation):
    """Generate enhanced PDF with proper medical report formatting"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72
    )
    
    # Get styles
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name='CustomTitle',
        parent=styles['Title'],
        fontSize=16,
        spaceAfter=30,
        alignment=1  # Center alignment
    ))
    styles.add(ParagraphStyle(
        name='CustomHeading',
        parent=styles['Heading1'],
        fontSize=12,
        spaceAfter=10,
        textColor=colors.HexColor('#2c3e50')
    ))
    styles.add(ParagraphStyle(
        name='CustomBody',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=8,
        leading=14
    ))
    
    # Add signature style
    styles.add(ParagraphStyle(
        name='SignatureStyle',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6,
        leading=16,
        textColor=colors.HexColor('#2c3e50'),
        alignment=0  # Left alignment
    ))
    
    # Build story
    story = []
    
    # Process content
    content = report['content']
    
    # Split content by horizontal rules
    sections = content.split('<hr>')
    
    for i, section in enumerate(sections):
        if section.strip():
            # Process each line in the section
            lines = section.strip().split('\n')
            for line in lines:
                if line.strip():
                    try:
                        # Clean up any problematic HTML
                        line = line.replace('</br>', '').replace('<br>', '')
                        line = line.replace('</para>', '').replace('<para>', '')
                        
                        # Use appropriate style based on content
                        if 'REPORTE MÉDICO' in line:
                            story.append(Paragraph(line, styles['CustomTitle']))
                        elif line.startswith('<b>'):
                            story.append(Paragraph(line, styles['CustomHeading']))
                        elif 'Firma del Médico' in section and not line.startswith('<b>'):
                            # Use signature style for signature section content
                            story.append(Paragraph(line, styles['SignatureStyle']))
                        else:
                            story.append(Paragraph(line, styles['CustomBody']))
                    except Exception as e:
                        print(f"Error processing line: {line}")
                        print(f"Error details: {str(e)}")
                        # If there's an error, try to add the line without formatting
                        story.append(Paragraph(re.sub('<[^<]+?>', '', line), styles['CustomBody']))
            
            # Add space between sections, but add extra space before signature section
            if i < len(sections) - 1:  # Not the last section
                if 'Firma del Médico' in section:
                    # Add extra space before signature section (about 4 lines worth)
                    story.append(Spacer(1, 60))  # 60 points = approximately 4 lines
                else:
                    story.append(Spacer(1, 20))
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer

# Report Routes
@app.route('/api/reports', methods=['GET'])
@jwt_required()
def get_reports():
    try:
        user_id = get_jwt_identity()
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        format_filter = request.args.get('format')
        
        # Build query
        query = {'doctor_id': user_id}
        if format_filter:
            query['format'] = format_filter
        
        # Get reports with pagination
        skip = (page - 1) * limit
        reports = list(db.reports.find(query).skip(skip).limit(limit).sort('created_at', -1))
        total = db.reports.count_documents(query)
        
        # Enrich with patient data
        for report in reports:
            patient = db.patients.find_one({'_id': ObjectId(report['patient_id'])})
            report['patient'] = serialize_doc(patient) if patient else None
        
        return jsonify({
            'reports': serialize_doc(reports),
            'total': total,
            'page': page,
            'pages': (total + limit - 1) // limit
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/<report_id>', methods=['GET'])
@jwt_required()
def get_report(report_id):
    try:
        user_id = get_jwt_identity()
        
        report = db.reports.find_one({
            '_id': ObjectId(report_id),
            'doctor_id': user_id
        })
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # Get related patient data
        patient = db.patients.find_one({'_id': ObjectId(report['patient_id'])})
        report['patient'] = serialize_doc(patient) if patient else None
        
        return jsonify({'report': serialize_doc(report)})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/<report_id>/download', methods=['GET'])
@jwt_required()
def download_report(report_id):
    try:
        user_id = get_jwt_identity()
        
        # Get report data
        report = db.reports.find_one({
            '_id': ObjectId(report_id),
            'doctor_id': user_id
        })
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
            
        if not report.get('file_path'):
            return jsonify({'error': 'Report file not found'}), 404
            
        # Check if file exists
        if not os.path.exists(report['file_path']):
            return jsonify({'error': 'Report file not found on server'}), 404
            
        # Get filename from path
        filename = os.path.basename(report['file_path'])
        
        # Send the file
        return send_file(
            report['file_path'],
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Error downloading report: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Dashboard and Statistics Routes
@app.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    try:
        user_id = get_jwt_identity()
        
        # Get basic counts
        total_patients = db.patients.count_documents({'doctor_id': user_id})
        total_consultations = db.consultations.count_documents({'doctor_id': user_id})
        total_reports = db.reports.count_documents({'doctor_id': user_id})
        
        # Get recent consultations with patient data
        recent_consultations = list(db.consultations.find({
            'doctor_id': user_id
        }).sort('created_at', -1).limit(5))
        
        # Enrich recent consultations with patient data
        recent_patients = []
        for consultation in recent_consultations:
            patient = db.patients.find_one({'_id': ObjectId(consultation['patient_id'])})
            if patient:
                recent_patients.append({
                    'consultation_id': str(consultation['_id']),
                    'patient': serialize_doc(patient),
                    'consultation_date': consultation['created_at'],
                    'audio_duration': consultation.get('audio_duration'),
                    'recording_type': consultation.get('recording_type', 'unknown')
                })
        
        return jsonify({
            'total_patients': total_patients,
            'total_consultations': total_consultations,
            'total_reports': total_reports,
            'recent_patients': recent_patients
        })
        
    except Exception as e:
        print(f"Dashboard Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('join_room')
def handle_join_room(data):
    user_id = data.get('user_id')
    if user_id:
        join_room(f'user-{user_id}')
        emit('joined_room', {'room': f'user-{user_id}'})

@socketio.on('get_transcription_progress')
def handle_get_progress(data):
    """Handle client request for transcription progress"""
    user_id = data.get('user_id')
    consultation_id = data.get('consultation_id')
    
    if user_id and consultation_id:
        try:
            transcription = db.transcriptions.find_one({
                'consultation_id': consultation_id,
                'doctor_id': user_id
            })
            
            if transcription:
                progress_data = {
                    'status': transcription.get('status', 'unknown'),
                    'processing_method': transcription.get('processing_method', 'standard'),
                    'chunk_count': transcription.get('chunk_count', 1),
                    'progress_percentage': 0
                }
                
                if transcription.get('status') == 'processing':
                    if transcription.get('processing_method') == 'chunked':
                        progress_data['progress_percentage'] = 50  # Estimate
                        progress_data['status_message'] = 'Processing large file in chunks...'
                    else:
                        progress_data['progress_percentage'] = 25  # Estimate
                        progress_data['status_message'] = 'Processing audio file...'
                elif transcription.get('status') == 'completed':
                    progress_data['progress_percentage'] = 100
                    progress_data['status_message'] = 'Transcription completed successfully!'
                
                emit('transcription_progress_update', progress_data)
            else:
                emit('transcription_progress_update', {
                    'error': 'Transcription not found'
                })
                
        except Exception as e:
            emit('transcription_progress_update', {
                'error': f'Error getting progress: {str(e)}'
            })

# Stripe Webhook
@app.route('/api/webhook/stripe', methods=['POST'])
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({'error': 'Invalid signature'}), 400

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_successful_payment(session)
    elif event['type'] == 'customer.subscription.updated':
        subscription = event['data']['object']
        handle_subscription_updated(subscription)
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_deleted(subscription)

    return jsonify({'status': 'success'}), 200

def handle_successful_payment(session):
    """Handle successful payment from Stripe"""
    try:
        user_id = session['metadata']['user_id']
        plan_id = session['metadata']['plan_id']
        
        # Get subscription from Stripe
        subscription = stripe.Subscription.retrieve(session['subscription'])
        
        # Create or update user subscription
        subscription_data = {
            'userId': user_id,
            'planId': plan_id,
            'stripeSubscriptionId': subscription.id,
            'stripeCustomerId': subscription.customer,
            'status': subscription.status,
            'currentPeriodStart': datetime.fromtimestamp(subscription.current_period_start),
            'currentPeriodEnd': datetime.fromtimestamp(subscription.current_period_end),
            'cancelAtPeriodEnd': subscription.cancel_at_period_end,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        db.user_subscriptions.update_one(
            {'userId': user_id},
            {'$set': subscription_data},
            upsert=True
        )
        
    except Exception as e:
        print(f"Error handling successful payment: {e}")

def handle_subscription_updated(subscription):
    """Handle subscription updates from Stripe"""
    try:
        db.user_subscriptions.update_one(
            {'stripeSubscriptionId': subscription.id},
            {'$set': {
                'status': subscription.status,
                'currentPeriodStart': datetime.fromtimestamp(subscription.current_period_start),
                'currentPeriodEnd': datetime.fromtimestamp(subscription.current_period_end),
                'cancelAtPeriodEnd': subscription.cancel_at_period_end,
                'updated_at': datetime.utcnow()
            }}
        )
    except Exception as e:
        print(f"Error handling subscription update: {e}")

def handle_subscription_deleted(subscription):
    """Handle subscription cancellation from Stripe"""
    try:
        db.user_subscriptions.update_one(
            {'stripeSubscriptionId': subscription.id},
            {'$set': {
                'status': 'canceled',
                'updated_at': datetime.utcnow()
            }}
        )
    except Exception as e:
        print(f"Error handling subscription deletion: {e}")

# Error Handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'error': 'File too large',
        'message': 'The uploaded file exceeds the maximum allowed size of 500MB. Please compress your audio file or use a shorter recording.',
        'max_size_mb': 500
    }), 413

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token has expired'}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Invalid token'}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Authorization token is required'}), 401

# Health Check
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'OK',
        'message': 'Clinix.ai API is running',
        'version': '2.0.0',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/auth/validate-token', methods=['GET'])
@jwt_required()
def validate_token():
    """Validate JWT token endpoint"""
    try:
        return jsonify({
            'message': 'Token is valid',
            'valid': True
        }), 200
    except Exception as e:
        return jsonify({
            'message': 'Token validation failed',
            'valid': False,
            'error': str(e)
        }), 500

# Report Preview and Edit Routes
@app.route('/api/consultations/<consultation_id>/report/preview', methods=['POST'])
@jwt_required()
def generate_report_preview(consultation_id):
    """Generate report preview data for editing"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        options = data.get('options', {})
        
        # Get consultation data
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        
        if not consultation:
            return jsonify({'error': 'Consultation not found'}), 404
            
        # Get patient data
        patient = db.patients.find_one({'_id': ObjectId(consultation['patient_id'])})
        if not patient:
            return jsonify({'error': 'Patient not found'}), 404
            
        # Get transcription data
        transcription = db.transcriptions.find_one({
            'consultation_id': consultation_id,
            'doctor_id': user_id
        })
        
        if not transcription:
            return jsonify({'error': 'Transcription not found'}), 404
        
        doctor = db.users.find_one({'_id': ObjectId(user_id)})
        
        # Generate AI report content
        report_content = generate_ai_report(transcription, consultation, patient, options, doctor)
        
        # Parse the report content into structured sections for editing
        structured_report = parse_report_into_sections(report_content, patient, consultation, doctor, transcription)
        
        # Create preview report record (temporary)
        preview_data = {
            'consultation_id': consultation_id,
            'patient_id': consultation['patient_id'],
            'doctor_id': user_id,
            'structured_content': structured_report,
            'options': options,
            'format': options.get('format', 'SOAP'),
            'generated_by': data.get('generatedBy', 'System'),
            'status': 'preview',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(hours=24)  # Preview expires in 24 hours
        }
        
        # Store or update preview in database
        existing_preview = db.report_previews.find_one({
            'consultation_id': consultation_id,
            'doctor_id': user_id
        })
        
        if existing_preview:
            db.report_previews.update_one(
                {'_id': existing_preview['_id']},
                {'$set': preview_data}
            )
            preview_data['_id'] = existing_preview['_id']
        else:
            result = db.report_previews.insert_one(preview_data)
            preview_data['_id'] = result.inserted_id
        
        return jsonify({
            'preview_id': str(preview_data['_id']),
            'structured_content': structured_report,
            'options': options
        })
        
    except Exception as e:
        print(f"Error generating report preview: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/consultations/<consultation_id>/report/preview/<preview_id>', methods=['PUT'])
@jwt_required()
def update_report_preview(consultation_id, preview_id):
    """Update report preview with edited content"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        updated_content = data.get('structured_content', {})
        
        # Find and update the preview
        preview = db.report_previews.find_one({
            '_id': ObjectId(preview_id),
            'consultation_id': consultation_id,
            'doctor_id': user_id
        })
        
        if not preview:
            return jsonify({'error': 'Preview not found'}), 404
        
        # Update the structured content
        db.report_previews.update_one(
            {'_id': ObjectId(preview_id)},
            {
                '$set': {
                    'structured_content': updated_content,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        return jsonify({
            'message': 'Preview updated successfully',
            'preview_id': preview_id
        })
        
    except Exception as e:
        print(f"Error updating report preview: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/consultations/<consultation_id>/report/preview/<preview_id>/generate', methods=['POST'])
@jwt_required()
def generate_final_report_from_preview(consultation_id, preview_id):
    """Generate final PDF from edited preview"""
    try:
        user_id = get_jwt_identity()
        
        # Get the preview data
        preview = db.report_previews.find_one({
            '_id': ObjectId(preview_id),
            'consultation_id': consultation_id,
            'doctor_id': user_id
        })
        
        if not preview:
            return jsonify({'error': 'Preview not found'}), 404
        
        # Get consultation and patient data
        consultation = db.consultations.find_one({
            '_id': ObjectId(consultation_id),
            'doctor_id': user_id
        })
        patient = db.patients.find_one({'_id': ObjectId(consultation['patient_id'])})
        
        # Convert structured content back to formatted report content
        final_report_content = convert_structured_to_report_content(preview['structured_content'])
        
        # Generate unique filename for the PDF
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_filename = f"consultation_report_{consultation_id}_{timestamp}.pdf"
        pdf_filepath = os.path.join('uploads', 'reports', pdf_filename)
        
        # Ensure reports directory exists
        os.makedirs(os.path.dirname(pdf_filepath), exist_ok=True)
        
        # Create final report record
        report_data = {
            'consultation_id': consultation_id,
            'patient_id': consultation['patient_id'],
            'doctor_id': user_id,
            'content': final_report_content,
            'structured_content': preview['structured_content'],  # Keep structured version too
            'options': preview['options'],
            'format': preview.get('format', 'SOAP'),
            'generated_by': preview.get('generated_by', 'System'),
            'status': 'generated',
            'file_path': pdf_filepath,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        result = db.reports.insert_one(report_data)
        report_data['_id'] = result.inserted_id
        
        # Generate PDF and save to file
        pdf_buffer = generate_enhanced_pdf(report_data, patient, consultation)
        
        with open(pdf_filepath, 'wb') as pdf_file:
            pdf_file.write(pdf_buffer.getvalue())
        
        # Clean up the preview record
        db.report_previews.delete_one({'_id': ObjectId(preview_id)})

        return send_file(
            io.BytesIO(pdf_buffer.getvalue()),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'consultation-report-{consultation_id}-{datetime.now().strftime("%Y%m%d")}.pdf'
        )
        
    except Exception as e:
        print(f"Error generating final report: {str(e)}")
        return jsonify({'error': str(e)}), 500

def parse_report_into_sections(report_content, patient, consultation, doctor, transcription):
    """Parse HTML report content into editable structured sections"""
    try:
        # Patient info
        patient_info = {
            'name': f"{patient['first_name']} {patient['last_name']}",
            'age': calculate_age(patient['date_of_birth']),
            'gender': patient.get('gender', ''),
            'date_of_birth': patient['date_of_birth'],
            'consultation_date': consultation['created_at'].strftime('%d/%m/%Y'),
            'consultation_time': consultation['created_at'].strftime('%H:%M'),
            'doctor_name': doctor.get('full_name', ''),
            'doctor_email': doctor.get('email', '')
        }
        
        # Initialize sections with default content
        sections = {
            'title': 'REPORTE MÉDICO',
            'subjective': '',
            'objective': '',
            'assessment': '',
            'plan': '',
            'vital_signs': '',
            'neurological_exam': '',
            'pharmacological_treatment': '',
            'self_care_measures': '',
            'dietary_recommendations': '',
            'follow_up': '',
            'signature': ''
        }
        
        # Define section patterns with more robust matching
        section_patterns = {
            'subjective': (r'<b>S - Subjetivo:</b>\s*(.*?)(?=<b>|$)', 'Subjective findings'),
            'objective': (r'<b>O - Objetivo:</b>\s*(.*?)(?=<b>|$)', 'Objective findings'),
            'assessment': (r'<b>A - Evaluación:</b>\s*(.*?)(?=<b>|$)', 'Assessment'),
            'plan': (r'<b>P - Plan:</b>\s*(.*?)(?=<b>|$)', 'Treatment plan'),
            'vital_signs': (r'<b>Signos Vitales:</b>\s*(.*?)(?=<b>|$)', 'Vital signs'),
            'neurological_exam': (r'<b>Examen Neurológico:</b>\s*(.*?)(?=<b>|$)', 'Neurological examination'),
            'pharmacological_treatment': (r'<b>Tratamiento Farmacológico:</b>\s*(.*?)(?=<b>|$)', 'Medications'),
            'self_care_measures': (r'<b>Medidas de Autocuidado:</b>\s*(.*?)(?=<b>|$)', 'Self-care instructions'),
            'dietary_recommendations': (r'<b>Recomendaciones Dietéticas:</b>\s*(.*?)(?=<b>|$)', 'Dietary recommendations'),
            'follow_up': (r'<b>Seguimiento:</b>\s*(.*?)(?=<b>|$)', 'Follow-up plan'),
            'signature': (r'<b>Firma del Médico:</b>\s*(.*?)(?=<b>|$)', 'Doctor\'s signature')
        }
        
        # Extract content for each section
        for section_key, (pattern, default_text) in section_patterns.items():
            match = re.search(pattern, report_content, re.DOTALL | re.IGNORECASE)
            if match:
                content = match.group(1).strip()
                # Clean up HTML tags and extra whitespace
                content = re.sub(r'<[^>]+>', '', content)
                content = re.sub(r'\s+', ' ', content).strip()
                sections[section_key] = content or default_text
        
        # Extract medical analysis data
        analysis = transcription.get('analysis', {})
        medical_info = analysis.get('medical_info', {})
        
        # Create structured data with all components
        structured_data = {
            'patient_info': patient_info,
            'sections': sections,
            'medical_analysis': {
                'symptoms': medical_info.get('symptoms', []),
                'medical_history': medical_info.get('medical_history', []),
                'current_medications': medical_info.get('current_medications', []),
                'diagnosis': medical_info.get('diagnosis', []),
                'treatment_plan': medical_info.get('treatment_plan', []),
                'follow_up': medical_info.get('follow_up', [])
            },
            'summary': analysis.get('summary', ''),
            'transcription_confidence': transcription.get('confidence_score', 0),
            'transcription_duration': transcription.get('duration', 0)
        }
        
        # Add default content if sections are empty
        if not any(sections.values()):
            sections.update({
                'subjective': 'Patient presents with...',
                'objective': 'Physical examination reveals...',
                'assessment': 'Based on the findings...',
                'plan': 'Treatment plan includes...',
            })
        
        return structured_data
        
    except Exception as e:
        print(f"Error parsing report into sections: {str(e)}")
        return {
            'patient_info': patient_info,
            'sections': sections,
            'medical_analysis': {
                'symptoms': [],
                'medical_history': [],
                'current_medications': [],
                'diagnosis': [],
                'treatment_plan': [],
                'follow_up': []
            },
            'summary': 'Error parsing report content',
            'transcription_confidence': 0,
            'transcription_duration': 0
        }

def convert_structured_to_report_content(structured_content):
    """Convert structured content back to formatted HTML report"""
    try:
        patient_info = structured_content.get('patient_info', {})
        sections = structured_content.get('sections', {})
        
        # Build the report content
        content_parts = []
        
        # Title
        content_parts.append('<b>REPORTE MÉDICO</b>')
        content_parts.append('')
        
        # Patient information header
        content_parts.append(f"<b>Paciente:</b> {patient_info.get('name', '')}")
        content_parts.append(f"<b>Edad:</b> {patient_info.get('age', '')} años")
        content_parts.append(f"<b>Género:</b> {patient_info.get('gender', '')}")
        content_parts.append(f"<b>Fecha de consulta:</b> {patient_info.get('consultation_date', '')}")
        content_parts.append(f"<b>Hora:</b> {patient_info.get('consultation_time', '')}")
        content_parts.append(f"<b>Médico:</b> Dr. {patient_info.get('doctor_name', '')}")
        content_parts.append(f"<b>Contacto Médico:</b> {patient_info.get('doctor_email', '')}")
        content_parts.append('')
        content_parts.append('<hr>')
        content_parts.append('')
        
        # SOAP sections
        soap_sections = [
            ('subjective', 'S - Subjetivo:'),
            ('objective', 'O - Objetivo:'),
            ('assessment', 'A - Evaluación:'),
            ('plan', 'P - Plan:')
        ]
        
        for section_key, section_title in soap_sections:
            if sections.get(section_key):
                content_parts.append(f'<b>{section_title}</b>')
                content_parts.append(sections[section_key])
                content_parts.append('')
        
        # Additional sections
        additional_sections = [
            ('vital_signs', 'Signos Vitales:'),
            ('neurological_exam', 'Examen Neurológico:'),
            ('pharmacological_treatment', 'Tratamiento Farmacológico:'),
            ('self_care_measures', 'Medidas de Autocuidado:'),
            ('dietary_recommendations', 'Recomendaciones Dietéticas:'),
            ('follow_up', 'Seguimiento:')
        ]
        
        for section_key, section_title in additional_sections:
            if sections.get(section_key):
                content_parts.append(f'<b>{section_title}</b>')
                content_parts.append(sections[section_key])
                content_parts.append('')
        
        # Signature section
        content_parts.append('')
        content_parts.append('')
        content_parts.append('')
        content_parts.append('<b>Firma del Médico:</b>')
        content_parts.append('')
        content_parts.append(f"Dr. {patient_info.get('doctor_name', '')}")
        content_parts.append(f"Contacto: {patient_info.get('doctor_email', '')}")
        content_parts.append(f"Fecha: {patient_info.get('consultation_date', '')}")
        
        return '\n'.join(content_parts)
        
    except Exception as e:
        print(f"Error converting structured to report content: {str(e)}")
        return "Error generating report content"

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, allow_unsafe_werkzeug=True)