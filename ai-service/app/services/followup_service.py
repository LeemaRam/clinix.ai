# ai-service/app/services/followup_service.py
import json, os
from openai import OpenAI
from twilio.rest import Client as TwilioClient

def extract_followup_from_soap(soap_note: dict, consultation_id: str) -> dict:
    followup_days = soap_note.get('follow_up_days', 7)
    plan = soap_note.get('plan', '')
    return {
        'follow_up_days': followup_days,
        'follow_up_reason': plan[:200] if plan else 'Routine follow-up',
        'consultation_id': consultation_id
    }

def send_whatsapp_reminder(patient_phone: str, patient_name: str,
                            doctor_name: str, follow_up_date: str, reason: str) -> dict:
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token  = os.getenv('TWILIO_AUTH_TOKEN')
    from_number = os.getenv('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')
    if not account_sid or not auth_token:
        return {'sent': False, 'error': 'Twilio credentials not configured in .env'}
    try:
        client = TwilioClient(account_sid, auth_token)
        message = client.messages.create(
            body=(
                f'Dear {patient_name}, this is a reminder from Dr. {doctor_name}. '
                f'Your follow-up appointment is scheduled for {follow_up_date}. '
                f'Reason: {reason}. Please contact the clinic to confirm your appointment.'
            ),
            from_=from_number,
            to=f'whatsapp:{patient_phone}'
        )
        return {'sent': True, 'message_sid': message.sid}
    except Exception as e:
        return {'sent': False, 'error': str(e)}