// MediTranslate+ Translator Module

class MedicalTranslator {
    constructor() {
        this.isRecording = false;
        this.recognition = null;
        this.currentTranslation = null;
        this.translationHistory = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        this.init();
    }

    init() {
        this.setupVoiceRecognition();
        this.loadTranslationHistory();
        this.setupEventListeners();
        this.checkURLParams();
    }

    setupEventListeners() {
        // Input text change
        const inputText = document.getElementById('inputText');
        if (inputText) {
            inputText.addEventListener('input', this.debounce(() => {
                this.autoSave();
            }, 500));
        }

        // Language selection change
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');
        
        if (sourceLanguage) {
            sourceLanguage.addEventListener('change', () => this.onLanguageChange());
        }
        if (targetLanguage) {
            targetLanguage.addEventListener('change', () => this.onLanguageChange());
        }

        // Enter key for translation
        if (inputText) {
            inputText.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    this.translateText();
                }
            });
        }
    }

    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateVoiceButton(true);
                this.showVoiceModal();
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const inputText = document.getElementById('inputText');
                if (inputText) {
                    inputText.value = finalTranscript + interimTranscript;
                }

                const voiceStatus = document.getElementById('voiceStatus');
                if (voiceStatus) {
                    voiceStatus.textContent = interimTranscript || 'Listening... Speak now';
                }
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateVoiceButton(false);
                this.hideVoiceModal();
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                this.updateVoiceButton(false);
                this.hideVoiceModal();
                MediTranslate.showNotification('Voice recognition failed. Please try again.', 'danger');
            };
        }
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('voice') === 'true') {
            setTimeout(() => this.startVoiceInput(), 1000);
        }
    }

    onLanguageChange() {
        // Auto-translate if there's existing text
        const inputText = document.getElementById('inputText');
        if (inputText && inputText.value.trim()) {
            this.debounce(() => this.translateText(), 1000)();
        }
    }

    async translateText() {
        const inputText = document.getElementById('inputText');
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');
        const translateBtn = document.getElementById('translateBtn');
        const outputSection = document.getElementById('outputSection');
        const loadingIndicator = document.getElementById('loadingIndicator');

        if (!inputText || !inputText.value.trim()) {
            MediTranslate.showNotification('Please enter text to translate', 'warning');
            return;
        }

        // Show loading state
        if (translateBtn) {
            translateBtn.disabled = true;
            translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Translating...';
        }
        
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (outputSection) outputSection.style.display = 'none';

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: inputText.value.trim(),
                    source_lang: sourceLanguage?.value || 'en',
                    target_lang: targetLanguage?.value || 'hi',
                    auto_detect: document.getElementById('autoDetect')?.checked || false
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.displayTranslation(data);
                this.addToHistory({
                    sourceText: inputText.value.trim(),
                    translatedText: data.translated_text,
                    sourceLang: data.source_lang,
                    targetLang: data.target_lang,
                    timestamp: new Date().toISOString()
                });
                
                // Auto-speak if enabled
                const autoSpeak = document.getElementById('autoSpeak');
                if (autoSpeak?.checked && data.voice_available) {
                    setTimeout(() => this.speakTranslation(data.translated_text, data.target_lang), 500);
                }
            } else if (data.needs_setup) {
                this.showAPIKeySetup(data.message);
            } else {
                throw new Error(data.error || 'Translation failed');
            }
        } catch (error) {
            console.error('Translation error:', error);
            MediTranslate.showNotification('Translation failed. Please try again.', 'danger');
        } finally {
            // Reset button state
            if (translateBtn) {
                translateBtn.disabled = false;
                translateBtn.innerHTML = '<i class="fas fa-language me-2"></i>Translate';
            }
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    displayTranslation(data) {
        const outputSection = document.getElementById('outputSection');
        const translatedText = document.getElementById('translatedText');

        if (translatedText) {
            translatedText.textContent = data.translated_text;
        }

        if (outputSection) {
            outputSection.style.display = 'block';
            outputSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        this.currentTranslation = data;

        // Auto-play audio if enabled
        const autoSpeak = MediTranslate.settings.autoSpeak;
        if (autoSpeak) {
            setTimeout(() => this.playTranslation(), 500);
        }
    }

    playTranslation() {
        if (!this.currentTranslation) return;
        this.speakTranslation(this.currentTranslation.translated_text, this.currentTranslation.target_lang);
    }

    speakTranslation(text, language) {
        const playButton = document.getElementById('playAudioBtn');
        if (playButton) {
            playButton.disabled = true;
            playButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Playing...';
        }

        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.getVoiceLang(language);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 1;

            // Find the best available voice
            const voices = speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => 
                voice.lang === utterance.lang || 
                voice.lang.startsWith(language)
            );
            
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            utterance.onstart = () => {
                if (playButton) {
                    playButton.innerHTML = '<i class="fas fa-stop me-2"></i>Stop';
                    playButton.classList.add('btn-danger', 'speaking-pulse');
                    playButton.classList.remove('btn-outline-primary');
                }
                this.addSpeakingAnimation();
            };

            utterance.onend = () => {
                this.removeSpeakingAnimation();
                if (playButton) {
                    playButton.disabled = false;
                    playButton.innerHTML = '<i class="fas fa-volume-up me-2"></i>Play Audio';
                    playButton.classList.remove('btn-danger');
                    playButton.classList.add('btn-outline-primary');
                }
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                if (playButton) {
                    playButton.disabled = false;
                    playButton.innerHTML = '<i class="fas fa-volume-up me-2"></i>Play Audio';
                    playButton.classList.remove('btn-danger');
                    playButton.classList.add('btn-outline-primary');
                }
                MediTranslate.showNotification('Voice playback failed. Please try again.', 'warning');
            };

            speechSynthesis.speak(utterance);
        } else {
            MediTranslate.showNotification('Voice playback not supported in this browser', 'warning');
            if (playButton) {
                playButton.disabled = false;
                playButton.innerHTML = '<i class="fas fa-volume-up me-2"></i>Play Audio';
            }
        }
    }

    getVoiceLang(langCode) {
        const langMap = {
            'en': 'en-IN',
            'hi': 'hi-IN',
            'ta': 'ta-IN',
            'te': 'te-IN',
            'bn': 'bn-IN',
            'gu': 'gu-IN',
            'mr': 'mr-IN',
            'kn': 'kn-IN',
            'ml': 'ml-IN',
            'or': 'or-IN',
            'pa': 'pa-IN',
            'as': 'as-IN',
            'ur': 'ur-IN'
        };
        return langMap[langCode] || 'en-IN';
    }

    showAPIKeySetup(message) {
        // Show API key setup notification
        const alertHtml = `
            <div class="alert alert-warning alert-dismissible fade show" role="alert">
                <i class="fas fa-key me-2"></i>
                <strong>API Setup Required:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const alertContainer = document.getElementById('alertContainer') || document.querySelector('.container');
        if (alertContainer) {
            alertContainer.insertAdjacentHTML('afterbegin', alertHtml);
        }
    }

    // Enhanced voice recognition with better error handling
    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.updateVoiceButton(true);
                this.showVoiceModal();
            };

            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const inputText = document.getElementById('inputText');
                if (inputText) {
                    inputText.value = finalTranscript + interimTranscript;
                    inputText.dispatchEvent(new Event('input'));
                }

                this.updateVoiceModal(interimTranscript || finalTranscript || 'Listening...');
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateVoiceButton(false);
                this.removeVoiceVisualization();
                this.hideVoiceModal();
                
                // Auto-translate if we got text
                const inputText = document.getElementById('inputText');
                if (inputText?.value.trim()) {
                    setTimeout(() => this.translateText(), 500);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.isRecording = false;
                this.updateVoiceButton(false);
                this.removeVoiceVisualization();
                this.hideVoiceModal();
                
                let errorMessage = 'Voice recognition failed';
                switch (event.error) {
                    case 'no-speech':
                        errorMessage = 'No speech detected. Please try again.';
                        break;
                    case 'audio-capture':
                        errorMessage = 'Microphone access denied or not available.';
                        break;
                    case 'not-allowed':
                        errorMessage = 'Microphone permission denied. Please allow access and try again.';
                        break;
                    case 'network':
                        errorMessage = 'Network error. Please check your connection.';
                        break;
                }
                
                MediTranslate.showNotification(errorMessage, 'danger');
            };
        } else {
            // Hide voice input button if not supported
            const voiceBtn = document.getElementById('voiceInputBtn');
            if (voiceBtn) {
                voiceBtn.style.display = 'none';
            }
        }
    }

    startVoiceInput() {
        if (!this.recognition) {
            MediTranslate.showNotification('Voice input not supported in this browser', 'warning');
            return;
        }

        if (this.isRecording) {
            this.stopVoiceInput();
            return;
        }

        // Request microphone permission first
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => {
                const sourceLanguage = document.getElementById('sourceLanguage');
                if (sourceLanguage) {
                    this.recognition.lang = this.getVoiceLang(sourceLanguage.value);
                }

                try {
                    this.recognition.start();
                    this.addVoiceVisualization();
                } catch (error) {
                    console.error('Voice recognition start error:', error);
                    MediTranslate.showNotification('Failed to start voice recognition', 'danger');
                }
            })
            .catch(error => {
                console.error('Microphone permission error:', error);
                MediTranslate.showNotification('Please allow microphone access for voice input', 'warning');
            });
    }

    addVoiceVisualization() {
        const voiceBtn = document.getElementById('voiceInputBtn');
        if (voiceBtn) {
            voiceBtn.classList.add('recording-pulse');
        }
        
        // Add visual feedback to input area
        const inputContainer = document.querySelector('.input-container') || document.querySelector('.form-group');
        if (inputContainer) {
            inputContainer.classList.add('voice-active');
        }
    }

    removeVoiceVisualization() {
        const voiceBtn = document.getElementById('voiceInputBtn');
        if (voiceBtn) {
            voiceBtn.classList.remove('recording-pulse');
        }
        
        const inputContainer = document.querySelector('.input-container') || document.querySelector('.form-group');
        if (inputContainer) {
            inputContainer.classList.remove('voice-active');
        }
    }

    stopVoiceInput() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    updateVoiceButton(isRecording) {
        const voiceBtn = document.getElementById('voiceInputBtn');
        if (voiceBtn) {
            if (isRecording) {
                voiceBtn.innerHTML = '<i class="fas fa-stop me-2"></i>Stop Recording';
                voiceBtn.classList.add('btn-danger');
                voiceBtn.classList.remove('btn-primary');
            } else {
                voiceBtn.innerHTML = '<i class="fas fa-microphone me-2"></i>Voice Input';
                voiceBtn.classList.add('btn-primary');
                voiceBtn.classList.remove('btn-danger');
            }
        }
    }

    showVoiceModal() {
        const voiceModal = document.getElementById('voiceModal');
        if (voiceModal) {
            const modal = new bootstrap.Modal(voiceModal);
            modal.show();
        }
    }

    hideVoiceModal() {
        const voiceModal = document.getElementById('voiceModal');
        if (voiceModal) {
            const modal = bootstrap.Modal.getInstance(voiceModal);
            if (modal) modal.hide();
        }
    }

    swapLanguages() {
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');
        const inputText = document.getElementById('inputText');
        const translatedText = document.getElementById('translatedText');

        if (sourceLanguage && targetLanguage) {
            const tempValue = sourceLanguage.value;
            sourceLanguage.value = targetLanguage.value;
            targetLanguage.value = tempValue;

            // Swap text content if available
            if (inputText && translatedText && this.currentTranslation) {
                const tempText = inputText.value;
                inputText.value = translatedText.textContent;
                
                // Clear current translation to trigger new one
                this.currentTranslation = null;
                const outputSection = document.getElementById('outputSection');
                if (outputSection) outputSection.style.display = 'none';
            }
        }
    }

    insertText(text) {
        const inputText = document.getElementById('inputText');
        if (inputText) {
            inputText.value = text;
            inputText.focus();
            // Auto-translate after a brief delay
            setTimeout(() => this.translateText(), 500);
        }
    }

    copyTranslation() {
        if (this.currentTranslation) {
            MediTranslate.copyToClipboard(this.currentTranslation.translated_text);
        }
    }

    clearTranslation() {
        const inputText = document.getElementById('inputText');
        const outputSection = document.getElementById('outputSection');
        
        if (inputText) inputText.value = '';
        if (outputSection) outputSection.style.display = 'none';
        
        this.currentTranslation = null;
    }

    async shareTranslation() {
        if (!this.currentTranslation) return;

        const shareData = {
            title: 'MediTranslate+ Translation',
            text: `${this.currentTranslation.sourceText} → ${this.currentTranslation.translated_text}`,
            url: window.location.href
        };

        await MediTranslate.shareContent(shareData);
    }

    addToHistory(translation) {
        this.translationHistory.unshift(translation);
        
        // Keep only last 50 translations
        if (this.translationHistory.length > 50) {
            this.translationHistory = this.translationHistory.slice(0, 50);
        }
        
        localStorage.setItem('translationHistory', JSON.stringify(this.translationHistory));
        this.updateHistoryDisplay();
    }

    loadTranslationHistory() {
        this.updateHistoryDisplay();
    }

    updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (this.translationHistory.length === 0) {
            historyList.innerHTML = '<p class="text-muted text-center">No recent translations</p>';
            return;
        }

        historyList.innerHTML = this.translationHistory.slice(0, 10).map((item, index) => `
            <div class="history-item border rounded p-3 mb-2 hover-lift" style="animation-delay: ${index * 0.1}s;">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="source-text mb-1">
                            <strong>${item.sourceLang.toUpperCase()}:</strong> ${item.sourceText}
                        </div>
                        <div class="translated-text text-primary">
                            <strong>${item.targetLang.toUpperCase()}:</strong> ${item.translatedText}
                        </div>
                        <small class="text-muted">${MediTranslate.formatDate(item.timestamp)}</small>
                    </div>
                    <div class="history-actions ms-2">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="translator.replayTranslation(${index})">
                            <i class="fas fa-redo"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="translator.copyHistoryItem(${index})">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    replayTranslation(index) {
        const item = this.translationHistory[index];
        if (!item) return;

        const inputText = document.getElementById('inputText');
        const sourceLanguage = document.getElementById('sourceLanguage');
        const targetLanguage = document.getElementById('targetLanguage');

        if (inputText) inputText.value = item.sourceText;
        if (sourceLanguage) sourceLanguage.value = item.sourceLang;
        if (targetLanguage) targetLanguage.value = item.targetLang;

        this.translateText();
    }

    copyHistoryItem(index) {
        const item = this.translationHistory[index];
        if (item) {
            MediTranslate.copyToClipboard(item.translatedText);
        }
    }

    autoSave() {
        const inputText = document.getElementById('inputText');
        if (inputText && inputText.value.trim()) {
            localStorage.setItem('translatorDraft', inputText.value);
        }
    }

    loadDraft() {
        const draft = localStorage.getItem('translatorDraft');
        const inputText = document.getElementById('inputText');
        if (draft && inputText && !inputText.value) {
            inputText.value = draft;
        }
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Global functions
window.startVoiceInput = () => translator.startVoiceInput();
window.stopVoiceInput = () => translator.stopVoiceInput();
window.swapLanguages = () => translator.swapLanguages();
window.insertText = (text) => translator.insertText(text);
window.translateText = () => translator.translateText();
window.playTranslation = () => translator.playTranslation();
window.copyTranslation = () => translator.copyTranslation();
window.clearTranslation = () => translator.clearTranslation();
window.shareTranslation = () => translator.shareTranslation();

// Initialize translator
const translator = new MedicalTranslator();

// Load draft on page load
document.addEventListener('DOMContentLoaded', () => {
    translator.loadDraft();
});
