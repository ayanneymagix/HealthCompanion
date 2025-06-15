// MediTranslate+ Chatbot Module
class MediChatbot {
    constructor() {
        this.isRecording = false;
        this.recognition = null;
        this.chatHistory = [];
        this.currentUtterance = null;
        this.sessionId = this.generateSessionId();
        
        this.init();
    }
    
    init() {
        this.loadChatHistory();
        this.setupEventListeners();
        this.initializeSpeechRecognition();
        this.checkEmergencyMode();
        this.autoScrollToBottom();
    }
    
    generateSessionId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            // Enter key to send message
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // Auto-resize textarea
            messageInput.addEventListener('input', () => {
                this.autoResizeInput();
                this.updateSendButton();
            });
        }
        
        // Chat messages scroll to bottom on new messages
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            const observer = new MutationObserver(() => {
                this.autoScrollToBottom();
            });
            observer.observe(chatMessages, { childList: true });
        }
    }
    
    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.recognition.lang = MediTranslate.currentLanguage === 'hi' ? 'hi-IN' : 'en-US';
            
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
    
    hideSpeechFeatures() {
        const voiceButtons = document.querySelectorAll('#voiceChatBtn');
        voiceButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    checkEmergencyMode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('emergency') === 'true') {
            this.enterEmergencyMode();
        }
    }
    
    enterEmergencyMode() {
        const emergencyMessage = MediTranslate.currentLanguage === 'hi' 
            ? 'आपातकालीन सहायता मोड सक्रिय। आपकी क्या समस्या है?'
            : 'Emergency assistance mode activated. What is your emergency?';
        
        this.addBotMessage(emergencyMessage, true);
        
        // Focus on input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.placeholder = MediTranslate.currentLanguage === 'hi' 
                ? 'अपनी आपातकालीन स्थिति बताएं...'
                : 'Describe your emergency situation...';
            messageInput.focus();
        }
    }
    
    autoResizeInput() {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        }
    }
    
    updateSendButton() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (messageInput && sendBtn) {
            const hasText = messageInput.value.trim().length > 0;
            sendBtn.disabled = !hasText;
            
            if (hasText) {
                sendBtn.classList.remove('btn-secondary');
                sendBtn.classList.add('btn-success');
            } else {
                sendBtn.classList.remove('btn-success');
                sendBtn.classList.add('btn-secondary');
            }
        }
    }
    
    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const chatLoading = document.getElementById('chatLoading');
        
        if (!messageInput || !messageInput.value.trim()) {
            MediTranslate.showNotification('Please enter a message', 'warning');
            return;
        }
        
        const message = messageInput.value.trim();
        
        try {
            // Add user message to chat
            this.addUserMessage(message);
            
            // Clear input and show loading
            messageInput.value = '';
            this.autoResizeInput();
            this.updateSendButton();
            
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }
            
            if (chatLoading) chatLoading.style.display = 'block';
            
            // Make API call
            const response = await MediTranslate.makeAPIRequest('/api/chat', {
                method: 'POST',
                body: JSON.stringify({
                    message: message,
                    language: MediTranslate.currentLanguage
                })
            });
            
            // Add bot response
            this.addBotMessage(response.response);
            
            // Add to history
            this.addToHistory({
                user: message,
                bot: response.response,
                timestamp: new Date(),
                language: MediTranslate.currentLanguage
            });
            
        } catch (error) {
            console.error('Chat error:', error);
            
            if (MediTranslate.isOffline) {
                this.addBotMessage(
                    MediTranslate.currentLanguage === 'hi' 
                        ? 'माफ़ करें, मैं ऑफलाइन मोड में उपलब्ध नहीं हूँ। कृपया इंटरनेट कनेक्शन जांचें।'
                        : 'I\'m sorry, I\'m not available in offline mode. Please check your internet connection.',
                    false,
                    'warning'
                );
            } else {
                this.addBotMessage(
                    MediTranslate.currentLanguage === 'hi' 
                        ? 'माफ़ करें, अभी मैं आपकी मदद नहीं कर सकता। कृपया बाद में पुनः प्रयास करें।'
                        : 'I\'m sorry, I\'m having trouble right now. Please try again later.',
                    false,
                    'error'
                );
            }
        } finally {
            // Reset UI state
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
            
            if (chatLoading) chatLoading.style.display = 'none';
            
            if (messageInput) {
                messageInput.focus();
            }
        }
    }
    
    addUserMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message user-message';
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user text-primary"></i>
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <p class="mb-0">${this.escapeHtml(message)}</p>
                </div>
                <small class="text-muted">${this.formatTime(new Date())}</small>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        this.autoScrollToBottom();
    }
    
    addBotMessage(message, isEmergency = false, type = 'info') {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = 'message bot-message';
        
        let bubbleClass = 'message-bubble';
        let iconClass = 'fas fa-robot text-success';
        
        if (isEmergency) {
            bubbleClass += ' border-danger';
            iconClass = 'fas fa-ambulance text-danger';
        } else if (type === 'warning') {
            bubbleClass += ' border-warning';
            iconClass = 'fas fa-exclamation-triangle text-warning';
        } else if (type === 'error') {
            bubbleClass += ' border-danger';
            iconClass = 'fas fa-exclamation-circle text-danger';
        }
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="${iconClass}"></i>
            </div>
            <div class="message-content">
                <div class="${bubbleClass}">
                    <p class="mb-2">${this.formatBotMessage(message)}</p>
                    <div class="bot-actions">
                        <button class="btn btn-sm btn-outline-success me-2" onclick="chatbot.playMessage('${this.escapeHtml(message).replace(/'/g, '&#39;')}')">
                            <i class="fas fa-volume-up me-1"></i>Play
                        </button>
                        <button class="btn btn-sm btn-outline-primary me-2" onclick="chatbot.copyMessage('${this.escapeHtml(message).replace(/'/g, '&#39;')}')">
                            <i class="fas fa-copy me-1"></i>Copy
                        </button>
                        <button class="btn btn-sm btn-outline-info" onclick="chatbot.translateMessage('${this.escapeHtml(message).replace(/'/g, '&#39;')}')">
                            <i class="fas fa-language me-1"></i>Translate
                        </button>
                    </div>
                    <div class="feedback-buttons mt-2">
                        <small class="text-muted me-2">Was this helpful?</small>
                        <button class="btn btn-sm btn-outline-success me-1" onclick="chatbot.provideFeedback(true)">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="chatbot.provideFeedback(false)">
                            <i class="fas fa-thumbs-down"></i>
                        </button>
                    </div>
                </div>
                <small class="text-muted">${this.formatTime(new Date())}</small>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        this.autoScrollToBottom();
        
        // Auto-play for emergency messages
        if (isEmergency) {
            setTimeout(() => this.playMessage(message), 500);
        }
    }
    
    formatBotMessage(message) {
        // Add medical icons for common terms
        const medicalTerms = {
            'fever': '<i class="fas fa-thermometer-half text-warning me-1"></i>',
            'headache': '<i class="fas fa-head-side-cough text-info me-1"></i>',
            'cough': '<i class="fas fa-lungs text-primary me-1"></i>',
            'medicine': '<i class="fas fa-pills text-success me-1"></i>',
            'doctor': '<i class="fas fa-user-md text-primary me-1"></i>',
            'hospital': '<i class="fas fa-hospital text-danger me-1"></i>',
            'emergency': '<i class="fas fa-ambulance text-danger me-1"></i>',
            'pain': '<i class="fas fa-heartbeat text-danger me-1"></i>'
        };
        
        let formattedMessage = this.escapeHtml(message);
        
        // Add icons for medical terms
        Object.keys(medicalTerms).forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            formattedMessage = formattedMessage.replace(regex, match => `${medicalTerms[term]}${match}`);
        });
        
        // Format lists
        formattedMessage = formattedMessage.replace(/\n- /g, '\n<i class="fas fa-circle text-primary me-2" style="font-size: 0.5rem;"></i>');
        
        // Format line breaks
        formattedMessage = formattedMessage.replace(/\n/g, '<br>');
        
        return formattedMessage;
    }
    
    playMessage(message) {
        try {
            if (this.currentUtterance) {
                window.speechSynthesis.cancel();
            }
            
            this.currentUtterance = MediTranslate.speakText(message, MediTranslate.currentLanguage);
        } catch (error) {
            console.error('Error playing message:', error);
            MediTranslate.showNotification('Audio playback failed', 'warning');
        }
    }
    
    copyMessage(message) {
        const cleanMessage = message.replace(/<[^>]*>/g, ''); // Remove HTML tags
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(cleanMessage).then(() => {
                MediTranslate.showNotification('Message copied to clipboard', 'success');
            }).catch(() => {
                this.fallbackCopyText(cleanMessage);
            });
        } else {
            this.fallbackCopyText(cleanMessage);
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
                MediTranslate.showNotification('Message copied to clipboard', 'success');
            } else {
                MediTranslate.showNotification('Failed to copy message', 'error');
            }
        } catch (err) {
            MediTranslate.showNotification('Copy not supported', 'warning');
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    translateMessage(message) {
        const cleanMessage = message.replace(/<[^>]*>/g, ''); // Remove HTML tags
        window.open(`/translator?text=${encodeURIComponent(cleanMessage)}`, '_blank');
    }
    
    provideFeedback(isPositive) {
        const feedbackText = isPositive 
            ? (MediTranslate.currentLanguage === 'hi' ? 'धन्यवाद! आपकी प्रतिक्रिया मददगार है।' : 'Thank you! Your feedback helps us improve.')
            : (MediTranslate.currentLanguage === 'hi' ? 'माफ़ करें। क्या मैं कुछ और मदद कर सकता हूँ?' : 'I apologize. Can I help you with something else?');
        
        MediTranslate.showNotification(feedbackText, isPositive ? 'success' : 'info');
        
        // If negative feedback, offer additional help
        if (!isPositive) {
            setTimeout(() => {
                this.addBotMessage(
                    MediTranslate.currentLanguage === 'hi' 
                        ? 'मैं आपकी बेहतर सहायता करना चाहता हूँ। कृपया अपना प्रश्न दूसरे तरीके से पूछें या अधिक विवरण दें।'
                        : 'I want to help you better. Please try rephrasing your question or provide more details.'
                );
            }, 1000);
        }
    }
    
    startVoiceChat() {
        if (!this.recognition) {
            MediTranslate.showNotification('Voice chat not supported on this device', 'warning');
            return;
        }
        
        if (this.isRecording) {
            this.stopVoiceChat();
            return;
        }
        
        try {
            // Show voice modal
            const voiceChatModal = new bootstrap.Modal(document.getElementById('voiceChatModal'));
            voiceChatModal.show();
            
            // Start recognition
            this.recognition.start();
            
        } catch (error) {
            console.error('Voice chat error:', error);
            MediTranslate.showNotification('Voice chat failed to start', 'error');
        }
    }
    
    stopVoiceChat() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
        
        // Hide modal
        const voiceChatModal = bootstrap.Modal.getInstance(document.getElementById('voiceChatModal'));
        if (voiceChatModal) {
            voiceChatModal.hide();
        }
    }
    
    onVoiceRecordingStart() {
        this.isRecording = true;
        
        const voiceChatBtn = document.getElementById('voiceChatBtn');
        const chatMicIcon = document.getElementById('chatMicIcon');
        const voiceChatStatus = document.getElementById('voiceChatStatus');
        
        if (voiceChatBtn) {
            voiceChatBtn.innerHTML = '<i class="fas fa-stop"></i>';
        }
        
        if (chatMicIcon) {
            chatMicIcon.classList.add('text-danger');
            chatMicIcon.classList.add('voice-animation');
        }
        
        if (voiceChatStatus) {
            voiceChatStatus.textContent = MediTranslate.currentLanguage === 'hi' 
                ? 'सुन रहा हूँ... अपना सवाल पूछें'
                : 'Listening... ask your question';
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
        
        const voiceChatStatus = document.getElementById('voiceChatStatus');
        if (voiceChatStatus) {
            if (isFinal) {
                voiceChatStatus.textContent = MediTranslate.currentLanguage === 'hi' 
                    ? 'प्रक्रिया हो रही है...'
                    : 'Processing...';
                this.processVoiceInput(transcript);
            } else {
                voiceChatStatus.textContent = `${MediTranslate.currentLanguage === 'hi' ? 'सुना गया' : 'Heard'}: "${transcript}"`;
            }
        }
    }
    
    onVoiceRecognitionError(event) {
        console.error('Voice recognition error:', event.error);
        
        const errorMessages = {
            'no-speech': MediTranslate.currentLanguage === 'hi' ? 'कोई आवाज़ नहीं सुनी गई।' : 'No speech detected.',
            'audio-capture': MediTranslate.currentLanguage === 'hi' ? 'माइक्रोफ़ोन एक्सेस नहीं है।' : 'Microphone not accessible.',
            'not-allowed': MediTranslate.currentLanguage === 'hi' ? 'माइक्रोफ़ोन की अनुमति नहीं।' : 'Microphone permission denied.',
            'network': MediTranslate.currentLanguage === 'hi' ? 'नेटवर्क त्रुटि।' : 'Network error.',
            'service-not-allowed': MediTranslate.currentLanguage === 'hi' ? 'आवाज़ सेवा उपलब्ध नहीं।' : 'Voice service not available.'
        };
        
        const message = errorMessages[event.error] || 
            (MediTranslate.currentLanguage === 'hi' ? 'आवाज़ पहचान में त्रुटि।' : 'Voice recognition failed.');
        
        MediTranslate.showNotification(message, 'error');
        this.onVoiceRecordingEnd();
    }
    
    onVoiceRecordingEnd() {
        this.isRecording = false;
        
        const voiceChatBtn = document.getElementById('voiceChatBtn');
        const chatMicIcon = document.getElementById('chatMicIcon');
        
        if (voiceChatBtn) {
            voiceChatBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
        
        if (chatMicIcon) {
            chatMicIcon.classList.remove('text-danger');
            chatMicIcon.classList.remove('voice-animation');
        }
        
        // Hide modal after delay
        setTimeout(() => {
            const voiceChatModal = bootstrap.Modal.getInstance(document.getElementById('voiceChatModal'));
            if (voiceChatModal) {
                voiceChatModal.hide();
            }
        }, 1000);
    }
    
    processVoiceInput(transcript) {
        if (transcript.trim()) {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.value = transcript.trim();
                this.updateSendButton();
                
                // Auto-send voice messages
                setTimeout(() => {
                    this.sendMessage();
                }, 500);
            }
        }
    }
    
    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            // Keep welcome message
            const welcomeMessage = chatMessages.querySelector('.message.bot-message');
            chatMessages.innerHTML = '';
            if (welcomeMessage) {
                chatMessages.appendChild(welcomeMessage);
            }
        }
        
        this.chatHistory = [];
        this.saveChatHistory();
        
        MediTranslate.showNotification(
            MediTranslate.currentLanguage === 'hi' ? 'चैट साफ़ कर दिया गया' : 'Chat cleared', 
            'info'
        );
    }
    
    askQuestion(question) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = question;
            this.updateSendButton();
            this.sendMessage();
        }
    }
    
    // Emergency functions
    callEmergency() {
        const phoneNumber = '108'; // Indian emergency number
        if (window.confirm(
            MediTranslate.currentLanguage === 'hi' 
                ? `क्या आप ${phoneNumber} पर कॉल करना चाहते हैं?`
                : `Do you want to call ${phoneNumber}?`
        )) {
            window.location.href = `tel:${phoneNumber}`;
        }
    }
    
    findHospital() {
        if (navigator.geolocation) {
            MediTranslate.showNotification(
                MediTranslate.currentLanguage === 'hi' 
                    ? 'आपका स्थान खोजा जा रहा है...'
                    : 'Finding your location...', 
                'info'
            );
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const googleMapsUrl = `https://www.google.com/maps/search/hospital+near+me/@${latitude},${longitude},15z`;
                    window.open(googleMapsUrl, '_blank');
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    const googleMapsUrl = 'https://www.google.com/maps/search/hospital';
                    window.open(googleMapsUrl, '_blank');
                }
            );
        } else {
            const googleMapsUrl = 'https://www.google.com/maps/search/hospital';
            window.open(googleMapsUrl, '_blank');
        }
    }
    
    firstAidGuide() {
        const firstAidMessage = MediTranslate.currentLanguage === 'hi' 
            ? `प्राथमिक चिकित्सा मार्गदर्शन:

🚨 आपातकाल में करें:
• शांत रहें और 108 पर कॉल करें
• मरीज़ को हिलाएं नहीं
• सांस लेने में मदद करें
• खुली हवा दें

🩹 चोट के लिए:
• साफ कपड़े से दबाएं
• घाव को ऊंचा रखें
• बर्फ़ लगाएं (10-15 मिनट)

💊 दवा की अधिक मात्रा:
• तुरंत अस्पताल जाएं
• उल्टी न कराएं
• दवा की बोतल साथ ले जाएं`
            : `First Aid Guidance:

🚨 In emergencies:
• Stay calm and call 108
• Don't move the patient
• Help with breathing
• Provide fresh air

🩹 For injuries:
• Apply pressure with clean cloth
• Elevate the wound
• Apply ice (10-15 minutes)

💊 Drug overdose:
• Go to hospital immediately
• Don't induce vomiting
• Bring medicine bottle`;
        
        this.addBotMessage(firstAidMessage, true);
    }
    
    shareLocation() {
        if (navigator.geolocation) {
            MediTranslate.showNotification(
                MediTranslate.currentLanguage === 'hi' 
                    ? 'आपका स्थान साझा किया जा रहा है...'
                    : 'Sharing your location...', 
                'info'
            );
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    const locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
                    const shareText = `My location: ${locationUrl}`;
                    
                    if (navigator.share) {
                        navigator.share({
                            title: 'My Location - Emergency',
                            text: shareText,
                            url: locationUrl
                        }).catch(() => {
                            this.fallbackShareLocation(locationUrl);
                        });
                    } else {
                        this.fallbackShareLocation(locationUrl);
                    }
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    MediTranslate.showNotification(
                        MediTranslate.currentLanguage === 'hi' 
                            ? 'स्थान साझा करने में त्रुटि'
                            : 'Error sharing location', 
                        'error'
                    );
                }
            );
        } else {
            MediTranslate.showNotification(
                MediTranslate.currentLanguage === 'hi' 
                    ? 'स्थान सेवा उपलब्ध नहीं'
                    : 'Location service not available', 
                'warning'
            );
        }
    }
    
    fallbackShareLocation(locationUrl) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(locationUrl).then(() => {
                MediTranslate.showNotification(
                    MediTranslate.currentLanguage === 'hi' 
                        ? 'स्थान लिंक कॉपी किया गया'
                        : 'Location link copied', 
                    'success'
                );
            });
        }
    }
    
    addToHistory(chat) {
        this.chatHistory.push(chat);
        
        // Limit history to 50 messages
        if (this.chatHistory.length > 50) {
            this.chatHistory = this.chatHistory.slice(-50);
        }
        
        this.saveChatHistory();
    }
    
    saveChatHistory() {
        MediTranslate.saveToLocalStorage(`chatHistory_${this.sessionId}`, this.chatHistory);
    }
    
    loadChatHistory() {
        const saved = MediTranslate.loadFromLocalStorage(`chatHistory_${this.sessionId}`);
        if (saved) {
            this.chatHistory = saved;
        }
    }
    
    autoScrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
function sendMessage() {
    if (window.chatbot) {
        window.chatbot.sendMessage();
    }
}

function startVoiceChat() {
    if (window.chatbot) {
        window.chatbot.startVoiceChat();
    }
}

function stopVoiceChat() {
    if (window.chatbot) {
        window.chatbot.stopVoiceChat();
    }
}

function clearChat() {
    if (window.chatbot) {
        window.chatbot.clearChat();
    }
}

function askQuestion(question) {
    if (window.chatbot) {
        window.chatbot.askQuestion(question);
    }
}

function callEmergency() {
    if (window.chatbot) {
        window.chatbot.callEmergency();
    }
}

function findHospital() {
    if (window.chatbot) {
        window.chatbot.findHospital();
    }
}

function firstAidGuide() {
    if (window.chatbot) {
        window.chatbot.firstAidGuide();
    }
}

function shareLocation() {
    if (window.chatbot) {
        window.chatbot.shareLocation();
    }
}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.chatbot = new MediChatbot();
});
