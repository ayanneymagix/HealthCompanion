import os
import json
import logging
import pytesseract
from PIL import Image
import re

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

def translate_text(text, source_lang='en', target_lang='hi'):
    """
    Translate text using Google Gemini with medical context awareness
    """
    try:
        if not model:
            return f"Translation service unavailable. Original text: {text}"
            
        # Language mapping
        lang_names = {
            'en': 'English',
            'hi': 'Hindi',
            'ta': 'Tamil',
            'te': 'Telugu',
            'bn': 'Bengali',
            'gu': 'Gujarati',
            'mr': 'Marathi'
        }
        
        source_name = lang_names.get(source_lang, 'English')
        target_name = lang_names.get(target_lang, 'Hindi')
        
        prompt = f"""
        You are a medical translation expert specializing in healthcare communication for rural Indian users.
        Translate the following {source_name} text to {target_name}, maintaining medical accuracy and using simple, clear language that rural users can understand.
        
        Text to translate: "{text}"
        
        Provide only the translation, without any explanations or additional text.
        If the text contains medical terms, ensure they are translated appropriately for common understanding.
        """
        
        response = model.generate_content(prompt)
        return response.text.strip()
    
    except Exception as e:
        logging.error(f"Translation error: {str(e)}")
        return f"Translation service unavailable. Original text: {text}"

def get_chatbot_response(message, language='en'):
    """
    Get healthcare chatbot response using Google Gemini
    """
    try:
        if not model:
            if language == 'hi':
                return "माफ़ करें, अभी मैं आपकी मदद नहीं कर सकता। कृपया बाद में पुनः प्रयास करें।"
            return "I'm sorry, I'm having trouble right now. Please try again later or consult a healthcare professional if it's urgent."
            
        lang_instruction = ""
        if language == 'hi':
            lang_instruction = "Respond in Hindi (Devanagari script). "
        elif language != 'en':
            lang_instruction = f"Respond in the user's language if possible. "
        
        prompt = f"""
        You are MediBot, a helpful healthcare assistant designed for rural Indian users. 
        {lang_instruction}
        
        Guidelines:
        - Provide simple, clear medical guidance
        - Always recommend consulting a doctor for serious symptoms
        - Use everyday language that rural users can understand
        - Be empathetic and supportive
        - Focus on preventive care and basic health education
        - If asked about specific medications, always advise consulting a healthcare professional
        - Provide practical home remedies when appropriate, but emphasize medical consultation
        - For emergency symptoms, immediately advise seeking urgent medical care
        - Provide step-by-step instructions for basic health queries
        
        Remember: You are not a replacement for professional medical advice.
        
        User message: {message}
        """
        
        response = model.generate_content(prompt)
        return response.text.strip()
    
    except Exception as e:
        logging.error(f"Chatbot error: {str(e)}")
        if language == 'hi':
            return "माफ़ करें, अभी मैं आपकी मदद नहीं कर सकता। कृपया बाद में पुनः प्रयास करें।"
        return "I'm sorry, I'm having trouble right now. Please try again later or consult a healthcare professional if it's urgent."

def extract_prescription_text(image_file):
    """
    Extract text from prescription image using OCR and Google Gemini processing
    """
    try:
        # Open and process image
        image = Image.open(image_file.stream)
        
        # Use Tesseract OCR to extract text
        raw_text = pytesseract.image_to_string(image, lang='eng')
        
        if not raw_text.strip():
            return {
                'error': 'No text could be extracted from the image',
                'raw_text': '',
                'medications': [],
                'dosages': [],
                'instructions': ''
            }
        
        if not model:
            # Return basic OCR results if AI model is unavailable
            return {
                'raw_text': raw_text,
                'medications': [],
                'dosages': [],
                'instructions': 'AI processing unavailable. Please review the extracted text manually.',
                'frequency': []
            }
        
        # Use Gemini AI to structure the extracted text
        analysis_prompt = f"""
        You are a medical prescription analyzer. Extract and structure information from this prescription text.
        
        Raw OCR Text:
        {raw_text}
        
        Please extract and return the information in JSON format:
        {{
            "medications": ["list of medication names"],
            "dosages": ["list of dosages with units"],
            "instructions": "general instructions for taking medications",
            "frequency": ["how often to take each medication"],
            "raw_text": "original extracted text"
        }}
        
        Return only valid JSON. If the text is unclear or incomplete, do your best to extract what you can and note any uncertainties.
        """
        
        response = model.generate_content(analysis_prompt)
        
        # Parse JSON response
        try:
            extracted_data = json.loads(response.text.strip())
        except json.JSONDecodeError:
            # If JSON parsing fails, create a basic structure
            extracted_data = {
                'medications': [],
                'dosages': [],
                'instructions': response.text.strip(),
                'frequency': [],
                'raw_text': raw_text
            }
        
        extracted_data['raw_text'] = raw_text
        return extracted_data
    
    except Exception as e:
        logging.error(f"OCR extraction error: {str(e)}")
        return {
            'error': 'Failed to process prescription image. Please try again or enter details manually.',
            'raw_text': '',
            'medications': [],
            'dosages': [],
            'instructions': ''
        }
