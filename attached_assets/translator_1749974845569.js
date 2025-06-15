// MediTranslate+ Translator Module
class MediTranslator {
    constructor() {
        this.isRecording = false;
        this.recognition = null;
        this.translationHistory = [];
        this.currentUtterance = null;
        
        this.init();
    }
    
    init() {
        this.loadTranslationHistory();
        this.setupEventListeners();
        this.initializeSpeechRecognition();
        
        // Check for voice input parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('voice') === 'true') {
            setTimeout(() => this.startVoiceInput(), 1000);
        }
    }
    
    setupEventListeners() {
        // Input text change
        const inputText = document.getElementById('inputText');
        if (inputText) {
            inputText.addEventListener('input', debounce(() => {
                this.checkInputLength();
            }, 500));
        }
        
        // Enter key to translate
        if (inputText) {
            inputText.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    this.translateText();
                }
            });
        }
        
        // Language change events
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');
        
        if (sourceLanguage) {
            sourceLanguage.addEventListener('change', () => {
                this.updateSpeechRecognitionLanguage();
            });
        }
    }
    
    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            
            this.updateSpeechRecognitionLanguage();
            
            this.recognition.onstart = () => {
                this.onVoiceRecordingStart();
            };
            
            this.recognition.onresult = (event) => {
                this.onVoiceRecognitionResult(event);
            };
            
            this.recognition.onerror = (event) => {
                this.onVoiceRecognitionError(event);
            };
            
            this.recognition.onend = () => {
                this.onVoiceRecordingEnd();
            };
        } else {
            console.warn('Speech recognition not supported');
            this.hideSpeechFeatures();
        }
    }
    
    updateSpeechRecognitionLanguage() {
        if (this.recognition) {
            const sourceLanguage = document.getElementById('sourceLanguage');
            if (sourceLanguage) {
                const langCode = sourceLanguage.value;
                const langMap = {
                    'en': 'en-US',
                    'hi': 'hi-IN',
                    'ta': 'ta-IN',
                    'te': 'te-IN',
                    'bn': 'bn-IN',
                    'gu': 'gu-IN',
                    'mr': 'mr-IN'
                };
                
                this.recognition.lang = langMap[langCode] || 'en-US';
            }
        }
    }
    
    hideSpeechFeatures() {
        const voiceButtons = document.querySelectorAll('[onclick*="Voice"]');
        voiceButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    checkInputLength() {
        const inputText = document.getElementById('inputText');
        const translateBtn = document.getElementById('translateBtn');
        
        if (inputText && translateBtn) {
            const hasText = inputText.value.trim().length > 0;
            translateBtn.disabled = !hasText;
            
            if (hasText) {
                translateBtn.classList.remove('btn-secondary');
                translateBtn.classList.add('btn-primary');
            } else {
                translateBtn.classList.remove('btn-primary');
                translateBtn.classList.add('btn-secondary');
            }
        }
    }
    
    async translateText() {
        const inputText = document.getElementById('inputText');
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');
        const translateBtn = document.getElementById('translateBtn');
        const loadingIndicator = document.getElementById('loadingIndicator');
        const outputSection = document.getElementById('outputSection');
        
        if (!inputText || !inputText.value.trim()) {
            MediTranslate.showNotification('Please enter text to translate', 'warning');
            return;
        }
        
        const text = inputText.value.trim();
        const sourceLang = sourceLanguage ? sourceLanguage.value : 'en';
        const targetLang = targetLanguage ? targetLanguage.value : 'hi';
        
        if (sourceLang === targetLang) {
            MediTranslate.showNotification('Source and target languages cannot be the same', 'warning');
            return;
        }
        
        try {
            // Show loading state
            if (translateBtn) {
                translateBtn.disabled = true;
                translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Translating...';
            }
            
            if (loadingIndicator) loadingIndicator.style.display = 'block';
            if (outputSection) outputSection.style.display = 'none';
            
            // Make API call
            const response = await MediTranslate.makeAPIRequest('/api/translate', {
                method: 'POST',
                body: JSON.stringify({
                    text: text,
                    source_lang: sourceLang,
                    target_lang: targetLang
                })
            });
            
            // Display results
            this.displayTranslationResult(response);
            
            // Add to history
            this.addToHistory({
                original: text,
                translated: response.translated_text,
                sourceLang: sourceLang,
                targetLang: targetLang,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Translation error:', error);
            
            if (MediTranslate.isOffline) {
                MediTranslate.showNotification('Translation requires internet connection', 'warning');
                this.showOfflineTranslation(text);
            } else {
                MediTranslate.showNotification('Translation failed. Please try again.', 'error');
            }
        } finally {
            // Reset button state
            if (translateBtn) {
                translateBtn.disabled = false;
                translateBtn.innerHTML = '<i class="fas fa-language me-2"></i>Translate';
            }
            
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }
    
    displayTranslationResult(response) {
        const translatedText = document.getElementById('translatedText');
        const outputSection = document.getElementById('outputSection');
        const targetLanguage = document.getElementById('targetLanguage');
        
        if (translatedText && outputSection) {
            translatedText.textContent = response.translated_text;
            outputSection.style.display = 'block';
            
            // Scroll to results
            outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Auto-speak translation if enabled in settings
            const settings = JSON.parse(localStorage.getItem('mediTranslateSettings') || '{}');
            if (settings.autoSpeak) {
                setTimeout(() => {
                    this.speakTranslation(response.translated_text, targetLanguage ? targetLanguage.value : 'hi');
                }, 500);
            }
            
            // Focus on the translated text for screen readers
            setTimeout(() => {
                translatedText.focus();
            }, 300);
        }
    }
    
    speakTranslation(text, language) {
        if (typeof speakText === 'function') {
            speakText(text, language);
        } else if ('speechSynthesis' in window) {
            // Fallback speech synthesis
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 1;
            
            const voices = speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => 
                voice.lang.startsWith(language === 'hi' ? 'hi' : 'en')
            );
            
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }
            
            speechSynthesis.speak(utterance);
        }
    }
    
    showOfflineTranslation(text) {
        const translatedText = document.getElementById('translatedText');
        const outputSection = document.getElementById('outputSection');
        
        if (translatedText && outputSection) {
            translatedText.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-wifi-slash me-2"></i>
                    <strong>Offline Mode:</strong> Translation service unavailable.<br>
                    <small class="mt-2 d-block">Original text: "${text}"</small>
                </div>
            `;
            outputSection.style.display = 'block';
        }
    }
    
    async playTranslation() {
        const translatedText = document.getElementById('translatedText');
        const playAudioBtn = document.getElementById('playAudioBtn');
        const targetLanguage = document.getElementById('targetLanguage');
        
        if (!translatedText || !translatedText.textContent.trim()) {
            MediTranslate.showNotification('No translation to play', 'warning');
            return;
        }
        
        const text = translatedText.textContent.trim();
        const language = targetLanguage ? targetLanguage.value : 'hi';
        
        try {
            // Update button state
            if (playAudioBtn) {
                playAudioBtn.disabled = true;
                playAudioBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Playing...';
            }
            
            // Stop any current speech
            if (this.currentUtterance) {
                window.speechSynthesis.cancel();
            }
            
            // Create and play speech
            this.currentUtterance = MediTranslate.speakText(text, language);
            
            if (this.currentUtterance) {
                this.currentUtterance.onend = () => {
                    if (playAudioBtn) {
                        playAudioBtn.disabled = false;
                        playAudioBtn.innerHTML = '<i class="fas fa-volume-up me-2"></i>Play Audio';
                    }
                };
                
                this.currentUtterance.onerror = () => {
                    if (playAudioBtn) {
                        playAudioBtn.disabled = false;
                        playAudioBtn.innerHTML = '<i class="fas fa-volume-up me-2"></i>Play Audio';
                    }
                    MediTranslate.showNotification('Audio playback failed', 'error');
                };
            }
            
        } catch (error) {
            console.error('Audio playback error:', error);
            MediTranslate.showNotification('Audio playback not supported', 'warning');
            
            if (playAudioBtn) {
                playAudioBtn.disabled = false;
                playAudioBtn.innerHTML = '<i class="fas fa-volume-up me-2"></i>Play Audio';
            }
        }
    }
    
    startVoiceInput() {
        if (!this.recognition) {
            MediTranslate.showNotification('Voice input not supported on this device', 'warning');
            return;
        }
        
        if (this.isRecording) {
            this.stopVoiceInput();
            return;
        }
        
        try {
            // Show voice modal
            const voiceModal = new bootstrap.Modal(document.getElementById('voiceModal'));
            voiceModal.show();
            
            // Start recognition
            this.recognition.start();
            
        } catch (error) {
            console.error('Voice input error:', error);
            MediTranslate.showNotification('Voice input failed to start', 'error');
        }
    }
    
    stopVoiceInput() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
        
        // Hide modal
        const voiceModal = bootstrap.Modal.getInstance(document.getElementById('voiceModal'));
        if (voiceModal) {
            voiceModal.hide();
        }
    }
    
    onVoiceRecordingStart() {
        this.isRecording = true;
        
        const voiceInputBtn = document.getElementById('voiceInputBtn');
        const micIcon = document.getElementById('micIcon');
        const voiceStatus = document.getElementById('voiceStatus');
        
        if (voiceInputBtn) {
            voiceInputBtn.innerHTML = '<i class="fas fa-stop me-2"></i>Stop Recording';
        }
        
        if (micIcon) {
            micIcon.classList.add('text-danger');
            micIcon.classList.add('voice-animation');
        }
        
        if (voiceStatus) {
            voiceStatus.textContent = 'Listening... Speak clearly';
        }
    }
    
    onVoiceRecognitionResult(event) {
        let transcript = '';
        let isFinal = false;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                isFinal = true;
            }
        }
        
        const voiceStatus = document.getElementById('voiceStatus');
        if (voiceStatus) {
            if (isFinal) {
                voiceStatus.textContent = 'Processing...';
                this.processVoiceInput(transcript);
            } else {
                voiceStatus.textContent = `Listening: "${transcript}"`;
            }
        }
    }
    
    onVoiceRecognitionError(event) {
        console.error('Voice recognition error:', event.error);
        
        const errorMessages = {
            'no-speech': 'No speech detected. Please try again.',
            'audio-capture': 'Microphone not accessible. Please check permissions.',
            'not-allowed': 'Microphone permission denied.',
            'network': 'Network error. Please check your connection.',
            'service-not-allowed': 'Voice recognition service not available.'
        };
        
        const message = errorMessages[event.error] || 'Voice recognition failed. Please try again.';
        MediTranslate.showNotification(message, 'error');
        
        this.onVoiceRecordingEnd();
    }
    
    onVoiceRecordingEnd() {
        this.isRecording = false;
        
        const voiceInputBtn = document.getElementById('voiceInputBtn');
        const micIcon = document.getElementById('micIcon');
        
        if (voiceInputBtn) {
            voiceInputBtn.innerHTML = '<i class="fas fa-microphone me-2"></i>Voice Input';
        }
        
        if (micIcon) {
            micIcon.classList.remove('text-danger');
            micIcon.classList.remove('voice-animation');
        }
        
        // Hide modal after delay
        setTimeout(() => {
            const voiceModal = bootstrap.Modal.getInstance(document.getElementById('voiceModal'));
            if (voiceModal) {
                voiceModal.hide();
            }
        }, 1000);
    }
    
    processVoiceInput(transcript) {
        if (transcript.trim()) {
            const inputText = document.getElementById('inputText');
            if (inputText) {
                inputText.value = transcript.trim();
                this.checkInputLength();
                
                // Auto-translate if text is detected
                setTimeout(() => {
                    this.translateText();
                }, 500);
            }
        }
    }
    
    copyTranslation() {
        const translatedText = document.getElementById('translatedText');
        
        if (!translatedText || !translatedText.textContent.trim()) {
            MediTranslate.showNotification('No translation to copy', 'warning');
            return;
        }
        
        const text = translatedText.textContent.trim();
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                MediTranslate.showNotification('Translation copied to clipboard', 'success');
            }).catch(() => {
                this.fallbackCopyText(text);
            });
        } else {
            this.fallbackCopyText(text);
        }
    }
    
    fallbackCopyText(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                MediTranslate.showNotification('Translation copied to clipboard', 'success');
            } else {
                MediTranslate.showNotification('Failed to copy translation', 'error');
            }
        } catch (err) {
            MediTranslate.showNotification('Copy not supported', 'warning');
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    clearTranslation() {
        const inputText = document.getElementById('inputText');
        const outputSection = document.getElementById('outputSection');
        const translatedText = document.getElementById('translatedText');
        
        if (inputText) inputText.value = '';
        if (outputSection) outputSection.style.display = 'none';
        if (translatedText) translatedText.textContent = '';
        
        this.checkInputLength();
        
        if (inputText) {
            inputText.focus();
        }
    }
    
    shareTranslation() {
        const inputText = document.getElementById('inputText');
        const translatedText = document.getElementById('translatedText');
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');
        
        if (!translatedText || !translatedText.textContent.trim()) {
            MediTranslate.showNotification('No translation to share', 'warning');
            return;
        }
        
        const original = inputText ? inputText.value.trim() : '';
        const translated = translatedText.textContent.trim();
        const sourceLang = sourceLanguage ? sourceLanguage.options[sourceLanguage.selectedIndex].text : '';
        const targetLang = targetLanguage ? targetLanguage.options[targetLanguage.selectedIndex].text : '';
        
        const shareText = `MediTranslate+ Translation:
${sourceLang}: ${original}
${targetLang}: ${translated}

Translated with MediTranslate+ - Healthcare for Everyone`;
        
        if (navigator.share) {
            navigator.share({
                title: 'MediTranslate+ Translation',
                text: shareText
            }).catch(() => {
                this.fallbackShare(shareText);
            });
        } else {
            this.fallbackShare(shareText);
        }
    }
    
    fallbackShare(text) {
        // Copy to clipboard as fallback
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                MediTranslate.showNotification('Translation copied for sharing', 'success');
            });
        } else {
            this.fallbackCopyText(text);
        }
    }
    
    swapLanguages() {
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');
        
        if (sourceLanguage && targetLanguage) {
            const sourceValue = sourceLanguage.value;
            const targetValue = targetLanguage.value;
            
            sourceLanguage.value = targetValue;
            targetLanguage.value = sourceValue;
            
            this.updateSpeechRecognitionLanguage();
            
            // Clear current translation
            this.clearTranslation();
        }
    }
    
    insertText(text) {
        const inputText = document.getElementById('inputText');
        if (inputText) {
            inputText.value = text;
            this.checkInputLength();
            inputText.focus();
        }
    }
    
    addToHistory(translation) {
        this.translationHistory.unshift(translation);
        
        // Limit history to 10 items
        if (this.translationHistory.length > 10) {
            this.translationHistory = this.translationHistory.slice(0, 10);
        }
        
        this.saveTranslationHistory();
        this.updateHistoryDisplay();
    }
    
    saveTranslationHistory() {
        MediTranslate.saveToLocalStorage('translationHistory', this.translationHistory);
    }
    
    loadTranslationHistory() {
        const saved = MediTranslate.loadFromLocalStorage('translationHistory');
        if (saved) {
            this.translationHistory = saved;
            this.updateHistoryDisplay();
        }
    }
    
    updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        if (this.translationHistory.length === 0) {
            historyList.innerHTML = '<p class="text-muted text-center">No recent translations</p>';
            return;
        }
        
        const historyHTML = this.translationHistory.map((item, index) => `
            <div class="card mb-2">
                <div class="card-body p-3">
                    <div class="row">
                        <div class="col-md-5">
                            <small class="text-muted d-block">${this.getLanguageName(item.sourceLang)}</small>
                            <p class="mb-1">${this.escapeHtml(item.original)}</p>
                        </div>
                        <div class="col-md-2 text-center">
                            <i class="fas fa-arrow-right text-muted"></i>
                        </div>
                        <div class="col-md-5">
                            <small class="text-muted d-block">${this.getLanguageName(item.targetLang)}</small>
                            <p class="mb-1">${this.escapeHtml(item.translated)}</p>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <small class="text-muted">${this.formatTimestamp(item.timestamp)}</small>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary btn-sm" onclick="translator.reuseTranslation(${index})">
                                <i class="fas fa-redo me-1"></i>Reuse
                            </button>
                            <button class="btn btn-outline-success btn-sm" onclick="translator.playHistoryItem(${index})">
                                <i class="fas fa-volume-up me-1"></i>Play
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        historyList.innerHTML = historyHTML;
    }
    
    reuseTranslation(index) {
        const item = this.translationHistory[index];
        if (item) {
            const inputText = document.getElementById('inputText');
            const sourceLanguage = document.getElementById('sourceLanguage');
            const targetLanguage = document.getElementById('targetLanguage');
            
            if (inputText) inputText.value = item.original;
            if (sourceLanguage) sourceLanguage.value = item.sourceLang;
            if (targetLanguage) targetLanguage.value = item.targetLang;
            
            this.displayTranslationResult({ translated_text: item.translated });
            this.updateSpeechRecognitionLanguage();
            this.checkInputLength();
        }
    }
    
    playHistoryItem(index) {
        const item = this.translationHistory[index];
        if (item) {
            MediTranslate.speakText(item.translated, item.targetLang);
        }
    }
    
    getLanguageName(code) {
        const languages = {
            'en': 'English',
            'hi': 'हिंदी',
            'ta': 'தமிழ்',
            'te': 'తెలుగు',
            'bn': 'বাংলা',
            'gu': 'ગુજરાતી',
            'mr': 'मराठी'
        };
        return languages[code] || code;
    }
    
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }
    
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Global functions for button onclick handlers
function swapLanguages() {
    if (window.translator) {
        window.translator.swapLanguages();
    }
}

function startVoiceInput() {
    if (window.translator) {
        window.translator.startVoiceInput();
    }
}

function stopVoiceInput() {
    if (window.translator) {
        window.translator.stopVoiceInput();
    }
}

function translateText() {
    if (window.translator) {
        window.translator.translateText();
    }
}

function playTranslation() {
    if (window.translator) {
        window.translator.playTranslation();
    }
}

function copyTranslation() {
    if (window.translator) {
        window.translator.copyTranslation();
    }
}

function clearTranslation() {
    if (window.translator) {
        window.translator.clearTranslation();
    }
}

function shareTranslation() {
    if (window.translator) {
        window.translator.shareTranslation();
    }
}

function insertText(text) {
    if (window.translator) {
        window.translator.insertText(text);
    }
}

// Initialize translator when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.translator = new MediTranslator();
});
