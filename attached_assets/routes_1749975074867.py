from flask import render_template, request, jsonify, session, redirect, url_for
from app import app, db
from models import MedicationReminder, ChatHistory, TranslationHistory, PrescriptionScan
from ai_services import translate_text, get_chatbot_response, extract_prescription_text
import json
import uuid
from datetime import datetime

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/translator')
def translator():
    return render_template('translator.html')

@app.route('/chatbot')
def chatbot():
    # Generate session ID if not exists
    if 'chat_session' not in session:
        session['chat_session'] = str(uuid.uuid4())
    return render_template('chatbot.html')

@app.route('/prescription')
def prescription():
    return render_template('prescription.html')

@app.route('/reminders')
def reminders():
    reminders = MedicationReminder.query.filter_by(is_active=True).all()
    return render_template('reminders.html', reminders=reminders)

@app.route('/api/translate', methods=['POST'])
def api_translate():
    try:
        data = request.get_json()
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'en')
        target_lang = data.get('target_lang', 'hi')
        
        if not text.strip():
            return jsonify({'error': 'Text is required'}), 400
        
        translated_text = translate_text(text, source_lang, target_lang)
        
        # Save to history
        history = TranslationHistory(
            original_text=text,
            translated_text=translated_text,
            source_language=source_lang,
            target_language=target_lang
        )
        db.session.add(history)
        db.session.commit()
        
        return jsonify({
            'translated_text': translated_text,
            'source_lang': source_lang,
            'target_lang': target_lang
        })
    except Exception as e:
        app.logger.error(f"Translation error: {str(e)}")
        return jsonify({'error': 'Translation failed. Please try again.'}), 500

@app.route('/api/chat', methods=['POST'])
def api_chat():
    try:
        data = request.get_json()
        message = data.get('message', '')
        language = data.get('language', 'en')
        
        if not message.strip():
            return jsonify({'error': 'Message is required'}), 400
        
        session_id = session.get('chat_session', str(uuid.uuid4()))
        
        # Get chat response
        bot_response = get_chatbot_response(message, language)
        
        # Save chat history
        chat_history = ChatHistory(
            session_id=session_id,
            user_message=message,
            bot_response=bot_response,
            language=language
        )
        db.session.add(chat_history)
        db.session.commit()
        
        return jsonify({
            'response': bot_response,
            'language': language
        })
    except Exception as e:
        app.logger.error(f"Chat error: {str(e)}")
        return jsonify({'error': 'Chat service is currently unavailable. Please try again later.'}), 500

@app.route('/api/scan-prescription', methods=['POST'])
def api_scan_prescription():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image selected'}), 400
        
        # Extract text from prescription
        extracted_data = extract_prescription_text(image_file)
        
        # Save scan results
        scan_result = PrescriptionScan(
            extracted_text=extracted_data.get('raw_text', ''),
            medications=json.dumps(extracted_data.get('medications', [])),
            dosages=json.dumps(extracted_data.get('dosages', [])),
            instructions=extracted_data.get('instructions', '')
        )
        db.session.add(scan_result)
        db.session.commit()
        
        return jsonify(extracted_data)
    except Exception as e:
        app.logger.error(f"Prescription scan error: {str(e)}")
        return jsonify({'error': 'Failed to scan prescription. Please try again or enter details manually.'}), 500

@app.route('/api/reminders', methods=['POST'])
def api_add_reminder():
    try:
        data = request.get_json()
        
        reminder = MedicationReminder(
            medication_name=data.get('medication_name', ''),
            dosage=data.get('dosage', ''),
            frequency=data.get('frequency', 'daily'),
            time_slots=json.dumps(data.get('time_slots', [])),
            notes=data.get('notes', '')
        )
        
        db.session.add(reminder)
        db.session.commit()
        
        return jsonify({'message': 'Reminder added successfully', 'id': reminder.id})
    except Exception as e:
        app.logger.error(f"Add reminder error: {str(e)}")
        return jsonify({'error': 'Failed to add reminder. Please try again.'}), 500

@app.route('/api/reminders/<int:reminder_id>', methods=['DELETE'])
def api_delete_reminder(reminder_id):
    try:
        reminder = MedicationReminder.query.get_or_404(reminder_id)
        reminder.is_active = False
        db.session.commit()
        return jsonify({'message': 'Reminder deleted successfully'})
    except Exception as e:
        app.logger.error(f"Delete reminder error: {str(e)}")
        return jsonify({'error': 'Failed to delete reminder. Please try again.'}), 500

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/api/offline-status')
def api_offline_status():
    return jsonify({'status': 'online', 'features_available': ['translate', 'chat', 'reminders']})
