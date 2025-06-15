// MediTranslate+ Chatbot Module

class HealthAssistant {
    constructor() {
        this.isRecording = false;
        this.recognition = null;
        this.chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        this.sessionId = this.generateSessionId();
        this.healthTips = [
            "Drink at least 8 glasses of water daily to stay hydrated.",
            "Get 7-9 hours of sleep for optimal health.",
            "Wash your hands frequently to prevent infections.",
            "Exercise for at least 30 minutes daily.",
            "Eat 5 servings of fruits and vegetables daily.",
            "Take breaks from screen time to rest your eyes.",
            "Practice deep breathing to reduce stress.",
            "Maintain good posture while sitting and standing."
        ];
        this.currentTipIndex = 0;
        this.init();
    }

    init() {
        this.setupVoiceRecognition();
        this.loadChatHistory();
        this.setupEventListeners();
        this.displayRandomHealthTip();
        this.checkEmergencyMode();
    }

    setupEventListeners() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');

        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            messageInput.addEventListener('input', () => {
                this.adjustTextareaHeight();
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Auto-scroll chat on new messages
        this.observeChatChanges();
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

                const messageInput = document.getElementById('messageInput');
                if (messageInput) {
                    messageInput.value = finalTranscript + interimTranscript;
                }

                const voiceStatus = document.getElementById('voiceStatus');
                if (voiceStatus) {
                    voiceStatus.textContent = interimTranscript || 'Listening... Speak your question';
                }
            };

            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateVoiceButton(false);
                this.hideVoiceModal();
                
                // Auto-send if we got text
                const messageInput = document.getElementById('messageInput');
                if (messageInput && messageInput.value.trim()) {
                    setTimeout(() => this.sendMessage(), 500);
                }
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

    checkEmergencyMode() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('emergency') === 'true') {
            this.addMessage('emergency', 'Emergency mode activated. Please describe your symptoms or emergency situation. For immediate medical emergencies, call 108.', true);
        }
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    adjustTextareaHeight() {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        
        if (!messageInput || !messageInput.value.trim()) return;

        const userMessage = messageInput.value.trim();
        messageInput.value = '';
        this.adjustTextareaHeight();

        // Disable send button temporarily
        if (sendBtn) {
            sendBtn.disabled = true;
        }

        // Add user message to chat
        this.addMessage('user', userMessage);

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    language: document.documentElement.lang || 'en',
                    context: this.getConversationContext()
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Add bot response
                setTimeout(() => {
                    this.hideTypingIndicator();
                    this.addMessage('bot', data.response, data.emergency_detected);
                    
                    // Auto-speak response if enabled
                    if (MediTranslate.settings.autoSpeak && data.voice_available) {
                        this.speakMessage(data.response);
                    }
                    
                    // Show suggestions if available
                    if (data.suggestions && data.suggestions.length > 0) {
                        this.showSuggestions(data.suggestions);
                    }
                }, 1000 + Math.random() * 1000);
            } else if (data.needs_setup) {
                this.hideTypingIndicator();
                this.addMessage('bot', 'I need my AI brain to be configured first. Please ask the administrator to set up the Google API key.');
                this.showAPISetupNotice(data.message);
            } else {
                throw new Error(data.error || 'Chat service unavailable');
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addMessage('bot', 'I apologize, but I\'m having trouble connecting right now. Please try again or consult with a healthcare professional for urgent matters.');
            MediTranslate.showNotification('Chat service temporarily unavailable', 'warning');
        } finally {
            // Re-enable send button
            if (sendBtn) {
                sendBtn.disabled = false;
            }
        }
    }

    getConversationContext() {
        // Get last few messages for context
        const recentMessages = this.chatHistory.slice(-5);
        return recentMessages.map(msg => `${msg.sender}: ${msg.message}`).join('\n');
    }

    showSuggestions(suggestions) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !suggestions.length) return;

        const suggestionsElement = document.createElement('div');
        suggestionsElement.className = 'suggestions-container fade-in';
        suggestionsElement.innerHTML = `
            <div class="suggestions-header">
                <i class="fas fa-lightbulb me-2"></i>
                Suggestions:
            </div>
            <div class="suggestions-list">
                ${suggestions.map(suggestion => `
                    <button class="btn btn-outline-primary btn-sm suggestion-btn" onclick="healthAssistant.askSuggestion('${suggestion}')">
                        ${suggestion}
                    </button>
                `).join('')}
            </div>
        `;

        chatMessages.appendChild(suggestionsElement);
        this.scrollToBottom();
    }

    askSuggestion(suggestion) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = suggestion;
            this.sendMessage();
        }
    }

    showAPISetupNotice(message) {
        const noticeHtml = `
            <div class="alert alert-info alert-dismissible fade show" role="alert">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Setup Required:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.insertAdjacentHTML('afterbegin', noticeHtml);
        }
    }

    addMessage(sender, message, isSystemMessage = false) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        const timestamp = new Date();
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (sender === 'user') {
            messageElement.className = 'message user-message slide-in-right';
            messageElement.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <div class="message-bubble">
                        <p class="mb-1">${this.escapeHtml(message)}</p>
                        <small class="text-muted">${timeString}</small>
                    </div>
                </div>
            `;
        } else {
            messageElement.className = `message bot-message slide-in-left ${isSystemMessage ? 'system-message' : ''}`;
            messageElement.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div class="message-bubble">
                        <p class="mb-1">${this.formatBotMessage(message)}</p>
                        <small class="text-muted">${timeString}</small>
                        ${!isSystemMessage ? `
                            <div class="message-actions mt-2">
                                <button class="btn btn-sm btn-outline-light me-1" onclick="chatbot.speakMessage('${this.escapeQuotes(message)}')" title="Read aloud">
                                    <i class="fas fa-volume-up"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-light me-1" onclick="chatbot.copyMessage('${this.escapeQuotes(message)}')" title="Copy message">
                                    <i class="fas fa-copy"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-light" onclick="chatbot.translateMessage('${this.escapeQuotes(message)}')" title="Translate">
                                    <i class="fas fa-language"></i>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        chatMessages.appendChild(messageElement);

        // Save to history (except system messages)
        if (!isSystemMessage) {
            const chatItem = {
                sender,
                message,
                timestamp: timestamp.toISOString(),
                sessionId: this.sessionId
            };
            
            this.chatHistory.push(chatItem);
            this.saveChatHistory();
        }

        // Scroll to bottom
        this.scrollToBottom();
    }

    formatBotMessage(message) {
        // Simple formatting for common medical terms
        let formatted = this.escapeHtml(message);
        
        // Bold important medical terms
        const medicalTerms = ['fever', 'headache', 'pain', 'medication', 'doctor', 'hospital', 'emergency', 'symptoms'];
        medicalTerms.forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            formatted = formatted.replace(regex, `<strong>$&</strong>`);
        });
        
        return formatted;
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingIndicator = document.getElementById('typingIndicator');
        
        if (chatMessages && typingIndicator) {
            typingIndicator.style.display = 'block';
            chatMessages.appendChild(typingIndicator);
            this.scrollToBottom();
        }
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.style.display = 'none';
        }
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            setTimeout(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 100);
        }
    }

    observeChatChanges() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages && 'MutationObserver' in window) {
            const observer = new MutationObserver(() => {
                this.scrollToBottom();
            });
            
            observer.observe(chatMessages, {
                childList: true,
                subtree: true
            });
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

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Voice recognition start error:', error);
            MediTranslate.showNotification('Voice input failed to start', 'danger');
        }
    }

    stopVoiceInput() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    updateVoiceButton(isRecording) {
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            if (isRecording) {
                voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
                voiceBtn.classList.add('btn-danger');
                voiceBtn.classList.remove('btn-success');
            } else {
                voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                voiceBtn.classList.add('btn-success');
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

    speakMessage(message) {
        if ('speechSynthesis' in window) {
            // Stop any ongoing speech
            speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            
            speechSynthesis.speak(utterance);
        } else {
            MediTranslate.showNotification('Text-to-speech not supported in this browser', 'warning');
        }
    }

    copyMessage(message) {
        MediTranslate.copyToClipboard(message);
    }

    translateMessage(message) {
        // Store message and redirect to translator
        localStorage.setItem('translateText', message);
        window.location.href = '/translator';
    }

    sendQuickMessage(message) {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = message;
            this.sendMessage();
        }
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            // Keep only the initial bot message
            const firstMessage = chatMessages.querySelector('.message.bot-message');
            chatMessages.innerHTML = '';
            if (firstMessage) {
                chatMessages.appendChild(firstMessage);
            }
        }
        
        // Clear session history but keep local storage
        this.sessionId = this.generateSessionId();
        MediTranslate.showNotification('Chat cleared', 'info');
    }

    displayRandomHealthTip() {
        const healthTip = document.getElementById('healthTip');
        if (healthTip && this.healthTips.length > 0) {
            const tip = this.healthTips[this.currentTipIndex];
            healthTip.innerHTML = `
                <p class="mb-0">
                    <i class="fas fa-lightbulb text-info me-2"></i>
                    ${tip}
                </p>
            `;
        }
    }

    getNewHealthTip() {
        this.currentTipIndex = (this.currentTipIndex + 1) % this.healthTips.length;
        this.displayRandomHealthTip();
        
        // Add animation
        const healthTip = document.getElementById('healthTip');
        if (healthTip) {
            healthTip.style.animation = 'none';
            setTimeout(() => {
                healthTip.style.animation = 'fadeIn 0.5s ease-in-out';
            }, 10);
        }
    }

    loadChatHistory() {
        // Load recent chat history for current session display
        const recentChats = this.chatHistory.slice(-10);
        const chatMessages = document.getElementById('chatMessages');
        
        if (chatMessages && recentChats.length > 1) {
            // Clear existing messages except the welcome message
            const welcomeMessage = chatMessages.querySelector('.message.bot-message');
            chatMessages.innerHTML = '';
            if (welcomeMessage) {
                chatMessages.appendChild(welcomeMessage);
            }
            
            // Add recent messages
            recentChats.forEach(chat => {
                if (chat.sender && chat.message) {
                    this.addMessage(chat.sender, chat.message, false);
                }
            });
        }
    }

    saveChatHistory() {
        // Keep only last 100 messages
        if (this.chatHistory.length > 100) {
            this.chatHistory = this.chatHistory.slice(-100);
        }
        
        localStorage.setItem('chatHistory', JSON.stringify(this.chatHistory));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeQuotes(text) {
        return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
}

// Global functions
window.startVoiceInput = () => chatbot.startVoiceInput();
window.stopVoiceInput = () => chatbot.stopVoiceInput();
window.sendQuickMessage = (message) => chatbot.sendQuickMessage(message);
window.clearChat = () => chatbot.clearChat();
window.getNewHealthTip = () => chatbot.getNewHealthTip();

// Initialize chatbot
const chatbot = new HealthAssistant();

// Auto-load translated text if coming from translator
document.addEventListener('DOMContentLoaded', () => {
    const translateText = localStorage.getItem('translateText');
    if (translateText) {
        localStorage.removeItem('translateText');
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = `Please explain: ${translateText}`;
            messageInput.focus();
        }
    }
});
