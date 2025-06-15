from app import db
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, Text, Boolean

class MedicationReminder(db.Model):
    id = db.Column(Integer, primary_key=True)
    medication_name = db.Column(String(200), nullable=False)
    dosage = db.Column(String(100), nullable=False)
    frequency = db.Column(String(50), nullable=False)  # daily, twice_daily, etc.
    time_slots = db.Column(String(200), nullable=False)  # JSON string of times
    start_date = db.Column(DateTime, nullable=False, default=datetime.utcnow)
    end_date = db.Column(DateTime, nullable=True)
    is_active = db.Column(Boolean, default=True)
    notes = db.Column(Text, nullable=True)
    created_at = db.Column(DateTime, default=datetime.utcnow)

class ChatHistory(db.Model):
    id = db.Column(Integer, primary_key=True)
    session_id = db.Column(String(100), nullable=False)
    user_message = db.Column(Text, nullable=False)
    bot_response = db.Column(Text, nullable=False)
    language = db.Column(String(10), default='en')
    timestamp = db.Column(DateTime, default=datetime.utcnow)

class TranslationHistory(db.Model):
    id = db.Column(Integer, primary_key=True)
    original_text = db.Column(Text, nullable=False)
    translated_text = db.Column(Text, nullable=False)
    source_language = db.Column(String(10), nullable=False)
    target_language = db.Column(String(10), nullable=False)
    timestamp = db.Column(DateTime, default=datetime.utcnow)

class PrescriptionScan(db.Model):
    id = db.Column(Integer, primary_key=True)
    extracted_text = db.Column(Text, nullable=False)
    medications = db.Column(Text, nullable=True)  # JSON string
    dosages = db.Column(Text, nullable=True)  # JSON string
    instructions = db.Column(Text, nullable=True)
    timestamp = db.Column(DateTime, default=datetime.utcnow)

class UserSettings(db.Model):
    id = db.Column(Integer, primary_key=True)
    user_id = db.Column(String(100), unique=True, nullable=False)
    theme = db.Column(String(20), default='light')
    language = db.Column(String(10), default='en')
    voice_enabled = db.Column(Boolean, default=True)
    notifications_enabled = db.Column(Boolean, default=True)
    settings_data = db.Column(Text, nullable=True)  # JSON string for compatibility
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
