import os
import json
import logging
import pytesseract
from PIL import Image
import re
import requests
from datetime import datetime

try:
    import google.generativeai as genai
    # Google Gemini AI configuration
    GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
    if GOOGLE_API_KEY:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash')
    else:
        model = None
        logging.warning("GOOGLE_API_KEY not found")
except ImportError:
    logging.error("Google Generative AI package not installed")
    model = None

# Enhanced language mapping with more Indian languages
LANGUAGE_MAPPING = {
    'en': 'English',
    'hi': 'Hindi (हिंदी)',
    'ta': 'Tamil (தமிழ்)',
    'te': 'Telugu (తెలుగు)',
    'bn': 'Bengali (বাংলা)',
    'gu': 'Gujarati (ગુજરાતી)',
    'mr': 'Marathi (मराठी)',
    'kn': 'Kannada (ಕನ್ನಡ)',
    'ml': 'Malayalam (മലയാളം)',
    'or': 'Odia (ଓଡ଼ିଆ)',
    'pa': 'Punjabi (ਪੰਜਾਬੀ)',
    'as': 'Assamese (অসমীয়া)',
    'ur': 'Urdu (اردو)'
}

def translate_text(text, source_lang='en', target_lang='hi'):
    """
    Enhanced translate text using Google Gemini with medical context awareness
    """
    try:
        if not model:
            return {
                'error': 'Translation service unavailable',
                'translated_text': f"Service unavailable. Original text: {text}",
                'needs_api_key': True
            }
            
        if not text or not text.strip():
            return {
                'error': 'Empty text provided',
                'translated_text': '',
                'needs_api_key': False
            }
        
        source_name = LANGUAGE_MAPPING.get(source_lang, 'English')
        target_name = LANGUAGE_MAPPING.get(target_lang, 'Hindi')
        
        # Enhanced medical translation prompt
        prompt = f"""
        You are an expert medical translator specializing in healthcare communication for Indian users.
        
        Task: Translate the following {source_name} text to {target_name}
        
        Guidelines:
        - Maintain medical accuracy while using simple, clear language
        - Use terms that rural and urban users can understand
        - Preserve medical terminology context
        - If medical terms don't have direct translations, provide explanations
        - Ensure cultural sensitivity in medical contexts
        - For symptoms, use commonly understood descriptions
        - For medications, provide both generic and common names if applicable
        
        Text to translate: "{text}"
        
        Important: Provide ONLY the translation without explanations, prefixes, or additional text.
        """
        
        response = model.generate_content(prompt)
        translated_text = response.text.strip()
        
        # Remove any quotation marks or extra formatting
        translated_text = translated_text.strip('"\'')
        
        return {
            'translated_text': translated_text,
            'source_lang': source_lang,
            'target_lang': target_lang,
            'source_name': source_name,
            'target_name': target_name,
            'confidence': 'high',
            'timestamp': datetime.now().isoformat()
        }
    
    except Exception as e:
        logging.error(f"Translation error: {str(e)}")
        return {
            'error': 'Translation failed',
            'translated_text': f"Translation service error. Original text: {text}",
            'needs_api_key': 'GOOGLE_API_KEY' in str(e)
        }

def get_chatbot_response(message, language='en', context=None):
    """
    Enhanced healthcare chatbot response using Google Gemini
    """
    try:
        if not model:
            emergency_response = {
                'en': "I'm currently unavailable. For medical emergencies, call 108 immediately. For non-urgent care, please consult a healthcare professional.",
                'hi': "मैं अभी उपलब्ध नहीं हूं। चिकित्सा आपातकाल के लिए, तुरंत 108 पर कॉल करें। गैर-जरूरी देखभाल के लिए, कृपया एक स्वास्थ्य पेशेवर से सलाह लें।"
            }
            return {
                'response': emergency_response.get(language, emergency_response['en']),
                'needs_api_key': True,
                'emergency_detected': False
            }
            
        if not message or not message.strip():
            return {
                'response': 'Please provide a message for me to respond to.',
                'needs_api_key': False,
                'emergency_detected': False
            }
        
        # Enhanced emergency keyword detection
        emergency_keywords = {
            'en': ['emergency', 'urgent', 'help', 'pain', 'bleeding', 'chest pain', 'heart attack', 'stroke', 'unconscious', 'breathing problem', 'severe', 'critical'],
            'hi': ['आपातकाल', 'जरूरी', 'मदद', 'दर्द', 'खून', 'सीने में दर्द', 'दिल का दौरा', 'स्ट्रोक', 'बेहोश', 'सांस की समस्या', 'गंभीर']
        }
        
        emergency_detected = any(keyword.lower() in message.lower() 
                               for keyword in emergency_keywords.get(language, emergency_keywords['en']))
        
        # Language-specific response instructions
        lang_instruction = ""
        if language == 'hi':
            lang_instruction = "Respond in Hindi (Devanagari script) using simple, clear language. "
        elif language != 'en':
            lang_name = LANGUAGE_MAPPING.get(language, 'the user language')
            lang_instruction = f"Respond in {lang_name} using simple, clear language. "
        else:
            lang_instruction = "Respond in English using simple, clear language. "
        
        # Context-aware prompt
        context_info = ""
        if context:
            context_info = f"Previous conversation context: {context}\n\n"
        
        prompt = f"""
        You are MediBot, an AI healthcare assistant designed for Indian users, especially those in rural areas.
        
        {lang_instruction}
        
        {context_info}Guidelines:
        - Provide helpful, accurate medical information in simple language
        - Always emphasize consulting healthcare professionals for diagnosis and treatment
        - Be culturally sensitive and aware of Indian healthcare practices
        - For symptoms, provide general guidance but stress professional consultation
        - Offer practical home remedies when appropriate, with safety warnings
        - Recognize emergency situations and advise immediate medical attention
        - Use everyday language that people without medical background can understand
        - Be empathetic and supportive in your tone
        - Provide step-by-step instructions for basic health queries
        - Include relevant dietary and lifestyle suggestions when appropriate
        
        IMPORTANT: You are not a replacement for professional medical advice. Always recommend consulting qualified healthcare providers.
        
        User message: {message}
        """
        
        response = model.generate_content(prompt)
        bot_response = response.text.strip()
        
        return {
            'response': bot_response,
            'language': language,
            'emergency_detected': emergency_detected,
            'confidence': 'high',
            'timestamp': datetime.now().isoformat(),
            'suggestions': extract_suggestions(bot_response) if not emergency_detected else []
        }
    
    except Exception as e:
        logging.error(f"Chatbot error: {str(e)}")
        fallback_responses = {
            'en': "I'm having technical difficulties. For medical emergencies, call 108. For other health concerns, please consult a healthcare professional.",
            'hi': "मुझे तकनीकी समस्या हो रही है। चिकित्सा आपातकाल के लिए 108 पर कॉल करें। अन्य स्वास्थ्य चिंताओं के लिए, कृपया एक स्वास्थ्य पेशेवर से सलाह लें।"
        }
        return {
            'response': fallback_responses.get(language, fallback_responses['en']),
            'needs_api_key': 'GOOGLE_API_KEY' in str(e),
            'emergency_detected': False,
            'error': str(e)
        }

def extract_prescription_text(image_file):
    """
    Enhanced prescription text extraction using OCR and Google Gemini processing
    """
    try:
        # Open and preprocess image
        image = Image.open(image_file.stream)
        
        # Enhance image for better OCR
        image = image.convert('RGB')
        
        # Use Tesseract OCR with enhanced configuration
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:-/() '
        raw_text = pytesseract.image_to_string(image, lang='eng', config=custom_config)
        
        if not raw_text.strip():
            return {
                'error': 'No text could be extracted from the image. Please ensure the image is clear and contains readable text.',
                'raw_text': '',
                'medications': [],
                'dosages': [],
                'instructions': '',
                'confidence': 'low'
            }
        
        if not model:
            # Return enhanced OCR results if AI model is unavailable
            return {
                'raw_text': raw_text,
                'medications': extract_basic_medications(raw_text),
                'dosages': extract_basic_dosages(raw_text),
                'instructions': 'AI processing unavailable. Please review the extracted text manually.',
                'frequency': [],
                'confidence': 'medium',
                'needs_api_key': True
            }
        
        # Enhanced Gemini AI analysis
        analysis_prompt = f"""
        You are a medical prescription analyzer. Extract and structure information from this prescription text with high accuracy.
        
        Raw OCR Text:
        {raw_text}
        
        Extract the following information and return as valid JSON:
        {{
            "medications": ["list of medication names with proper spelling"],
            "dosages": ["list of dosages with units (mg, ml, etc.)"],
            "frequency": ["how often to take each medication (e.g., twice daily, once daily)"],
            "instructions": "detailed instructions for taking medications",
            "duration": "duration of treatment if mentioned",
            "doctor_name": "prescribing doctor's name if visible",
            "date": "prescription date if visible",
            "raw_text": "original extracted text",
            "confidence": "high/medium/low based on text clarity"
        }}
        
        Guidelines:
        - Correct common OCR errors in medication names
        - Standardize dosage formats
        - Extract timing information (morning, evening, after meals, etc.)
        - Include any special instructions or warnings
        - Mark uncertain extractions with [?] notation
        
        Return only valid JSON without any additional text.
        """
        
        response = model.generate_content(analysis_prompt)
        
        try:
            extracted_data = json.loads(response.text.strip())
            extracted_data['raw_text'] = raw_text
            extracted_data['processing_time'] = datetime.now().isoformat()
            
            # Validate extracted data
            if not isinstance(extracted_data.get('medications'), list):
                extracted_data['medications'] = []
            if not isinstance(extracted_data.get('dosages'), list):
                extracted_data['dosages'] = []
            if not isinstance(extracted_data.get('frequency'), list):
                extracted_data['frequency'] = []
                
            return extracted_data
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                'raw_text': raw_text,
                'medications': extract_basic_medications(raw_text),
                'dosages': extract_basic_dosages(raw_text),
                'instructions': response.text.strip(),
                'frequency': [],
                'confidence': 'medium',
                'processing_time': datetime.now().isoformat()
            }
    
    except Exception as e:
        logging.error(f"OCR extraction error: {str(e)}")
        return {
            'error': f'Failed to process prescription image: {str(e)}',
            'raw_text': '',
            'medications': [],
            'dosages': [],
            'instructions': 'Please try again with a clearer image or enter details manually.',
            'confidence': 'low'
        }

def extract_basic_medications(text):
    """Extract basic medication names from text using pattern matching"""
    medication_patterns = [
        r'\b[A-Z][a-z]+(?:cillin|mycin|pril|sartan|olol|pine|zide|statin)\b',
        r'\b(?:Tab|Tablet|Cap|Capsule|Syrup|Injection)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b'
    ]
    
    medications = []
    for pattern in medication_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        medications.extend(matches)
    
    return list(set(medications))

def extract_basic_dosages(text):
    """Extract basic dosage information from text"""
    dosage_patterns = [
        r'\b\d+\s*(?:mg|ml|g|mcg|units?)\b',
        r'\b\d+/\d+\s*(?:mg|ml|g|mcg)\b'
    ]
    
    dosages = []
    for pattern in dosage_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dosages.extend(matches)
    
    return list(set(dosages))

def extract_suggestions(response_text):
    """Extract actionable suggestions from chatbot response"""
    suggestions = []
    
    # Look for common suggestion patterns
    suggestion_patterns = [
        r'try\s+([^.]+)',
        r'consider\s+([^.]+)',
        r'you\s+(?:should|could|might)\s+([^.]+)'
    ]
    
    for pattern in suggestion_patterns:
        matches = re.findall(pattern, response_text, re.IGNORECASE)
        suggestions.extend([match.strip() for match in matches[:3]])  # Limit to 3 suggestions
    
    return suggestions

def get_voice_synthesis_url(text, language='en'):
    """
    Generate voice synthesis URL for text-to-speech functionality
    """
    try:
        # This would integrate with a TTS service
        # For now, return a structured response for frontend handling
        return {
            'text': text,
            'language': language,
            'voice_available': True,
            'synthesis_method': 'browser_native'  # Use browser's built-in TTS
        }
    except Exception as e:
        logging.error(f"Voice synthesis error: {str(e)}")
        return {
            'text': text,
            'language': language,
            'voice_available': False,
            'error': str(e)
        }

def detect_language(text):
    """
    Detect the language of input text
    """
    try:
        if not model:
            return 'en'  # Default fallback
            
        prompt = f"""
        Detect the language of this text and return only the language code (en, hi, ta, te, bn, gu, mr, kn, ml, or, pa, as, ur).
        
        Text: "{text}"
        
        Return only the two-letter language code.
        """
        
        response = model.generate_content(prompt)
        detected_lang = response.text.strip().lower()
        
        # Validate the detected language
        if detected_lang in LANGUAGE_MAPPING:
            return detected_lang
        else:
            return 'en'  # Default fallback
            
    except Exception as e:
        logging.error(f"Language detection error: {str(e)}")
        return 'en'  # Default fallback