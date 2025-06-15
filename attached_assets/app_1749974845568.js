// MediTranslate+ Main Application JavaScript

// Global variables
let currentLanguage = 'en';
let isOffline = false;
let speechRecognition = null;
let speechSynthesis = window.speechSynthesis;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    checkOnlineStatus();
    initializeSpeechRecognition();
    initializeServiceWorker();
    loadLanguagePreferences();
});

// Initialize main app functions
function initializeApp() {
    console.log('MediTranslate+ Application Initialized');
    
    // Add click handlers for accessibility
    addAccessibilityHandlers();
    
    // Initialize tooltips if available
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

// Online/Offline Status Management
function checkOnlineStatus() {
    updateOnlineStatus();
    
    window.addEventListener('online', function() {
        isOffline = false;
        updateOnlineStatus();
        showNotification('Connection restored', 'success');
    });
    
    window.addEventListener('offline', function() {
        isOffline = true;
        updateOnlineStatus();
        showNotification('You are offline. Some features may be limited.', 'warning');
    });
}

function updateOnlineStatus() {
    const onlineIcon = document.getElementById('onlineIcon');
    const offlineIcon = document.getElementById('offlineIcon');
    const statusText = document.querySelector('.offline-indicator .status-text');
    
    if (onlineIcon && offlineIcon && statusText) {
        if (navigator.onLine && !isOffline) {
            onlineIcon.classList.remove('d-none');
            offlineIcon.classList.add('d-none');
            statusText.textContent = 'Online';
            statusText.className = 'status-text text-success';
        } else {
            onlineIcon.classList.add('d-none');
            offlineIcon.classList.remove('d-none');
            statusText.textContent = 'Offline';
            statusText.className = 'status-text text-danger';
        }
    }
}

// Language Management
function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'hi' : 'en';
    updateLanguageDisplay();
    saveLanguagePreference();
    translatePage();
}

function updateLanguageDisplay() {
    const langToggle = document.getElementById('currentLang');
    if (langToggle) {
        langToggle.textContent = currentLanguage === 'en' ? 'EN' : 'हि';
    }
}

function saveLanguagePreference() {
    localStorage.setItem('preferredLanguage', currentLanguage);
}

function loadLanguagePreferences() {
    const saved = localStorage.getItem('preferredLanguage');
    if (saved) {
        currentLanguage = saved;
        updateLanguageDisplay();
        translatePage();
    }
}

// Simple page translation (basic implementation)
function translatePage() {
    const translations = {
        'en': {
            'welcome-title': 'Welcome to MediTranslate+',
            'welcome-subtitle': 'Your AI-powered healthcare companion for rural communities',
            'translator-title': 'AI Translator',
            'translator-desc': 'Translate medical terms and symptoms between languages with voice support',
            'chatbot-title': 'Health Assistant',
            'chatbot-desc': 'Get instant health guidance and medical information from our AI assistant',
            'scanner-title': 'Scan Prescription',
            'scanner-desc': 'Scan and extract medication details from prescriptions using OCR technology',
            'reminders-title': 'Med Reminders',
            'reminders-desc': 'Set smart medication reminders with customizable schedules and alerts'
        },
        'hi': {
            'welcome-title': 'मेडीट्रांसलेट+ में आपका स्वागत है',
            'welcome-subtitle': 'ग्रामीण समुदायों के लिए आपका AI-संचालित स्वास्थ्य साथी',
            'translator-title': 'AI अनुवादक',
            'translator-desc': 'आवाज समर्थन के साथ भाषाओं के बीच चिकित्सा शब्दों और लक्षणों का अनुवाद करें',
            'chatbot-title': 'स्वास्थ्य सहायक',
            'chatbot-desc': 'हमारे AI सहायक से तुरंत स्वास्थ्य मार्गदर्शन और चिकित्सा जानकारी प्राप्त करें',
            'scanner-title': 'प्रिस्क्रिप्शन स्कैन',
            'scanner-desc': 'OCR तकनीक का उपयोग करके प्रिस्क्रिप्शन से दवा विवरण स्कैन और निकालें',
            'reminders-title': 'दवा रिमाइंडर',
            'reminders-desc': 'अनुकूलन योग्य समयसूची और अलर्ट के साथ स्मार्ट दवा रिमाइंडर सेट करें'
        }
    };
    
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[currentLanguage] && translations[currentLanguage][key]) {
            element.textContent = translations[currentLanguage][key];
        }
    });
    
    // Translate placeholders
    const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
    placeholderElements.forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        if (translations[currentLanguage] && translations[currentLanguage][key]) {
            element.placeholder = translations[currentLanguage][key];
        }
    });
}

// Speech Recognition Setup - Enhanced with better error handling
function initializeSpeechRecognition() {
    try {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            speechRecognition = new SpeechRecognition();
            
            // Enhanced configuration for better performance
            speechRecognition.continuous = false;
            speechRecognition.interimResults = true;
            speechRecognition.maxAlternatives = 1;
            speechRecognition.lang = currentLanguage === 'hi' ? 'hi-IN' : 'en-US';
            
            // Add comprehensive event handlers
            speechRecognition.onstart = function() {
                console.log('Speech recognition started');
            };
            
            speechRecognition.onend = function() {
                console.log('Speech recognition ended');
            };
            
            speechRecognition.onerror = function(event) {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'network') {
                    showNotification('Network error. Please check your internet connection.', 'warning');
                } else if (event.error === 'not-allowed') {
                    showNotification('Microphone access denied. Please allow microphone access.', 'warning');
                } else {
                    showNotification('Voice recognition failed. Please try again.', 'warning');
                }
            };
            
            console.log('Speech recognition initialized');
            return true;
        } else {
            console.log('Speech recognition not supported');
            // Hide voice-related buttons if not supported
            document.querySelectorAll('.voice-btn, .speech-btn').forEach(btn => {
                btn.style.display = 'none';
            });
            return false;
        }
    } catch (error) {
        console.error('Error initializing speech recognition:', error);
        return false;
    }
}

// Text-to-Speech
function speakText(text, language = currentLanguage) {
    if (speechSynthesis) {
        // Cancel any ongoing speech
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        // Get available voices
        const voices = speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.lang.startsWith(language === 'hi' ? 'hi' : 'en')
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        speechSynthesis.speak(utterance);
        return utterance;
    }
    return null;
}

// Notification System
function showNotification(message, type = 'info', duration = 5000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
    `;
    
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// API Helper Functions
async function makeAPIRequest(url, options = {}) {
    try {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        
        if (!navigator.onLine) {
            showNotification('You are offline. Please check your connection.', 'warning');
        } else {
            showNotification('Service temporarily unavailable. Please try again.', 'error');
        }
        
        throw error;
    }
}

// Accessibility Helpers
function addAccessibilityHandlers() {
    // Add keyboard navigation support
    document.addEventListener('keydown', function(e) {
        // Escape key to close modals
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(modal => {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) {
                    modalInstance.hide();
                }
            });
        }
        
        // Enter key to activate clickable elements
        if (e.key === 'Enter' && e.target.classList.contains('feature-card')) {
            e.target.click();
        }
    });
    
    // Add focus management for dynamic content
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Focus management for new elements
                const newElements = Array.from(mutation.addedNodes).filter(node => 
                    node.nodeType === Node.ELEMENT_NODE
                );
                
                newElements.forEach(element => {
                    if (element.matches('.alert, .modal')) {
                        // Focus first focusable element in new alerts or modals
                        const focusable = element.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                        if (focusable) {
                            setTimeout(() => focusable.focus(), 100);
                        }
                    }
                });
            }
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

// Service Worker for PWA
function initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// Utility Functions
function formatTime(date) {
    return date.toLocaleTimeString(currentLanguage === 'hi' ? 'hi-IN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(date) {
    return date.toLocaleDateString(currentLanguage === 'hi' ? 'hi-IN' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function debounce(func, wait) {
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

// Local Storage Helpers
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
        return false;
    }
}

function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('Failed to load from localStorage:', error);
        return null;
    }
}

// Error Handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    showNotification('An unexpected error occurred. Please refresh the page.', 'danger');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    showNotification('A network error occurred. Please check your connection.', 'warning');
});

// Export for use in other modules
window.MediTranslate = {
    currentLanguage,
    toggleLanguage,
    speakText,
    showNotification,
    makeAPIRequest,
    saveToLocalStorage,
    loadFromLocalStorage,
    speechRecognition,
    isOffline
};
