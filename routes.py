from flask import render_template, request, jsonify, session, redirect, url_for
from app import app, db
from models import MedicationReminder, ChatHistory, TranslationHistory, PrescriptionScan, UserSettings
from ai_services import translate_text, get_chatbot_response, extract_prescription_text, get_voice_synthesis_url, detect_language
import json
import uuid
from datetime import datetime

@app.route('/')
def home():
    """Home page with feature overview"""
    reminders = MedicationReminder.query.filter_by(is_active=True).all()
    return render_template('home.html', reminders=reminders)

@app.route('/translator')
def translator():
    """AI Medical Translator page"""
    return render_template('translator.html')

@app.route('/chatbot')
def chatbot():
    """Health Assistant Chatbot page"""
    # Generate session ID if not exists
    if 'chat_session' not in session:
        session['chat_session'] = str(uuid.uuid4())
    return render_template('chatbot.html')

@app.route('/prescription')
def prescription():
    """Prescription Scanner page"""
    return render_template('prescription.html')

@app.route('/reminders')
def reminders():
    """Medication Reminders page"""
    reminders = MedicationReminder.query.filter_by(is_active=True).all()
    return render_template('reminders.html', reminders=reminders)

@app.route('/about')
def about():
    """About page with team information"""
    return render_template('about.html')

@app.route('/settings')
def settings():
    """Settings and preferences page"""
    return render_template('settings.html')

# API Routes

@app.route('/api/translate', methods=['POST'])
def api_translate():
    """Enhanced text translation with voice support"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        source_lang = data.get('source_lang', 'en')
        target_lang = data.get('target_lang', 'hi')
        auto_detect = data.get('auto_detect', False)
        
        if not text.strip():
            return jsonify({'error': 'Text is required'}), 400
        
        # Auto-detect language if requested
        if auto_detect:
            detected_lang = detect_language(text)
            if detected_lang != source_lang:
                source_lang = detected_lang
        
        # Perform translation
        translation_result = translate_text(text, source_lang, target_lang)
        
        if 'error' in translation_result:
            if translation_result.get('needs_api_key'):
                return jsonify({
                    'error': 'Translation service requires API key',
                    'needs_setup': True,
                    'message': 'Please configure GOOGLE_API_KEY to enable AI translation'
                }), 503
            return jsonify({'error': translation_result['error']}), 500
        
        # Save to history
        try:
            history = TranslationHistory(
                original_text=text,
                translated_text=translation_result['translated_text'],
                source_language=source_lang,
                target_language=target_lang,
                timestamp=datetime.utcnow()
            )
            db.session.add(history)
            db.session.commit()
        except Exception as db_error:
            app.logger.warning(f"Failed to save translation history: {str(db_error)}")
        
        # Get voice synthesis info
        voice_info = get_voice_synthesis_url(
            translation_result['translated_text'], 
            target_lang
        )
        
        response_data = {
            'success': True,
            'translated_text': translation_result['translated_text'],
            'source_lang': source_lang,
            'target_lang': target_lang,
            'source_name': translation_result.get('source_name', ''),
            'target_name': translation_result.get('target_name', ''),
            'confidence': translation_result.get('confidence', 'medium'),
            'voice_available': voice_info.get('voice_available', False),
            'voice_synthesis': voice_info
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        app.logger.error(f"Translation API error: {str(e)}")
        return jsonify({
            'error': 'Translation service temporarily unavailable',
            'message': 'Please try again later'
        }), 500

@app.route('/api/chat', methods=['POST'])
def api_chat():
    """Enhanced chatbot with context and voice support"""
    try:
        data = request.get_json()
        message = data.get('message', '')
        language = data.get('language', 'en')
        context = data.get('context', '')
        
        if not message.strip():
            return jsonify({'error': 'Message is required'}), 400
        
        session_id = session.get('chat_session', str(uuid.uuid4()))
        session['chat_session'] = session_id
        
        # Get chat response with context
        chat_result = get_chatbot_response(message, language, context)
        
        if 'error' in chat_result:
            if chat_result.get('needs_api_key'):
                return jsonify({
                    'error': 'Health assistant requires API key',
                    'needs_setup': True,
                    'message': 'Please configure GOOGLE_API_KEY to enable AI health assistance'
                }), 503
            return jsonify({'error': chat_result['error']}), 500
        
        # Save chat history
        try:
            chat_history = ChatHistory(
                session_id=session_id,
                user_message=message,
                bot_response=chat_result['response'],
                language=language,
                timestamp=datetime.utcnow()
            )
            db.session.add(chat_history)
            db.session.commit()
        except Exception as db_error:
            app.logger.warning(f"Failed to save chat history: {str(db_error)}")
        
        # Get voice synthesis for response
        voice_info = get_voice_synthesis_url(chat_result['response'], language)
        
        response_data = {
            'success': True,
            'response': chat_result['response'],
            'language': language,
            'emergency_detected': chat_result.get('emergency_detected', False),
            'suggestions': chat_result.get('suggestions', []),
            'confidence': chat_result.get('confidence', 'medium'),
            'voice_available': voice_info.get('voice_available', False),
            'voice_synthesis': voice_info
        }
        
        return jsonify(response_data)
        
    except Exception as e:
        app.logger.error(f"Chat API error: {str(e)}")
        return jsonify({
            'error': 'Health assistant temporarily unavailable',
            'message': 'For medical emergencies, call 108 immediately'
        }), 500

@app.route('/api/scan-prescription', methods=['POST'])
def api_scan_prescription():
    """Enhanced prescription scanning with better error handling"""
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
        filename = image_file.filename or ''
        file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        
        if file_ext not in allowed_extensions:
            return jsonify({
                'error': 'Invalid file type',
                'message': 'Please upload an image file (PNG, JPG, JPEG, GIF, BMP, TIFF)'
            }), 400
        
        # Extract text from prescription
        extracted_data = extract_prescription_text(image_file)
        
        if 'error' in extracted_data:
            if extracted_data.get('needs_api_key'):
                return jsonify({
                    'error': 'Prescription analysis requires API key',
                    'needs_setup': True,
                    'message': 'Please configure GOOGLE_API_KEY to enable AI prescription analysis'
                }), 503
            return jsonify({'error': extracted_data['error']}), 400
        
        # Save scan results
        try:
            scan_result = PrescriptionScan(
                extracted_text=extracted_data.get('raw_text', ''),
                medications=json.dumps(extracted_data.get('medications', [])),
                dosages=json.dumps(extracted_data.get('dosages', [])),
                instructions=extracted_data.get('instructions', ''),
                timestamp=datetime.utcnow()
            )
            db.session.add(scan_result)
            db.session.commit()
            extracted_data['scan_id'] = scan_result.id
        except Exception as db_error:
            app.logger.warning(f"Failed to save prescription scan: {str(db_error)}")
        
        return jsonify(extracted_data)
        
    except Exception as e:
        app.logger.error(f"Prescription scan error: {str(e)}")
        return jsonify({
            'error': 'Failed to process prescription',
            'message': 'Please try again with a clearer image or enter details manually'
        }), 500

@app.route('/api/reminders', methods=['POST'])
def api_add_reminder():
    """Add medication reminder with enhanced validation"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['medication_name', 'dosage', 'frequency', 'time_slots']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'error': f'{field.replace("_", " ").title()} is required'
                }), 400
        
        # Validate time slots format
        time_slots = data.get('time_slots', [])
        if not isinstance(time_slots, list) or not time_slots:
            return jsonify({'error': 'At least one time slot is required'}), 400
        
        reminder = MedicationReminder(
            medication_name=data.get('medication_name', ''),
            dosage=data.get('dosage', ''),
            frequency=data.get('frequency', 'daily'),
            time_slots=json.dumps(time_slots),
            notes=data.get('notes', ''),
            start_date=datetime.utcnow(),
            is_active=True,
            created_at=datetime.utcnow()
        )
        
        db.session.add(reminder)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Medication reminder added successfully',
            'reminder_id': reminder.id,
            'next_dose': time_slots[0] if time_slots else None
        })
        
    except Exception as e:
        app.logger.error(f"Add reminder error: {str(e)}")
        return jsonify({
            'error': 'Failed to add reminder',
            'message': 'Please check your input and try again'
        }), 500

@app.route('/api/reminders/<int:reminder_id>', methods=['DELETE'])
def api_delete_reminder(reminder_id):
    """Delete medication reminder"""
    try:
        reminder = MedicationReminder.query.get_or_404(reminder_id)
        reminder.is_active = False
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Reminder deleted successfully'
        })
        
    except Exception as e:
        app.logger.error(f"Delete reminder error: {str(e)}")
        return jsonify({
            'error': 'Failed to delete reminder',
            'message': 'Please try again'
        }), 500

@app.route('/api/settings', methods=['GET', 'POST'])
def api_settings():
    """Get or update user settings"""
    try:
        user_id = session.get('user_id', 'anonymous')
        
        if request.method == 'GET':
            settings = UserSettings.query.filter_by(user_id=user_id).first()
            if not settings:
                # Return default settings
                return jsonify({
                    'theme': 'light',
                    'language': 'en',
                    'voice_enabled': True,
                    'notifications_enabled': True,
                    'settings_data': '{}'
                })
            
            return jsonify({
                'theme': settings.theme,
                'language': settings.language,
                'voice_enabled': settings.voice_enabled,
                'notifications_enabled': settings.notifications_enabled,
                'settings_data': settings.settings_data or '{}'
            })
        
        elif request.method == 'POST':
            data = request.get_json()
            
            settings = UserSettings.query.filter_by(user_id=user_id).first()
            if not settings:
                settings = UserSettings(
                    user_id=user_id,
                    theme=data.get('theme', 'light'),
                    language=data.get('language', 'en'),
                    voice_enabled=data.get('voice_enabled', True),
                    notifications_enabled=data.get('notifications_enabled', True),
                    settings_data=json.dumps(data.get('settings_data', {})),
                    updated_at=datetime.utcnow()
                )
                db.session.add(settings)
            else:
                settings.theme = data.get('theme', settings.theme)
                settings.language = data.get('language', settings.language)
                settings.voice_enabled = data.get('voice_enabled', settings.voice_enabled)
                settings.notifications_enabled = data.get('notifications_enabled', settings.notifications_enabled)
                settings.settings_data = json.dumps(data.get('settings_data', {}))
                settings.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Settings updated successfully'
            })
            
    except Exception as e:
        app.logger.error(f"Settings API error: {str(e)}")
        return jsonify({
            'error': 'Failed to process settings',
            'message': 'Please try again'
        }), 500

@app.route('/api/voice-synthesis', methods=['POST'])
def api_voice_synthesis():
    """Voice synthesis endpoint for text-to-speech"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        language = data.get('language', 'en')
        
        if not text.strip():
            return jsonify({'error': 'Text is required'}), 400
        
        voice_info = get_voice_synthesis_url(text, language)
        return jsonify(voice_info)
        
    except Exception as e:
        app.logger.error(f"Voice synthesis error: {str(e)}")
        return jsonify({
            'error': 'Voice synthesis failed',
            'voice_available': False
        }), 500

@app.route('/api/offline-status')
def api_offline_status():
    """Check application status and available features"""
    try:
        # Check database connectivity
        db_status = 'online'
        try:
            db.session.execute('SELECT 1')
        except:
            db_status = 'offline'
        
        # Check AI service availability
        ai_status = 'limited'  # Will be 'online' if API key is configured
        
        return jsonify({
            'status': 'online',
            'database_status': db_status,
            'ai_status': ai_status,
            'features_available': {
                'translate': True,
                'chat': True,
                'reminders': db_status == 'online',
                'prescription_scan': True,
                'voice_synthesis': True
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"Status check error: {str(e)}")
        return jsonify({
            'status': 'degraded',
            'error': str(e)
        }), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    """404 error handler"""
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """500 error handler"""
    db.session.rollback()
    return render_template('500.html'), 500

@app.errorhandler(503)
def service_unavailable(error):
    """503 error handler"""
    return render_template('500.html'), 503