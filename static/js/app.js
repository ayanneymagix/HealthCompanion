// MediTranslate+ Main Application JavaScript

// Global application state
const MediTranslate = {
    isOnline: navigator.onLine,
    theme: localStorage.getItem('theme') || 'light',
    settings: JSON.parse(localStorage.getItem('mediTranslateSettings') || '{}'),
    translations: JSON.parse(localStorage.getItem('translationHistory') || '[]'),
    chatHistory: JSON.parse(localStorage.getItem('chatHistory') || '[]'),
    reminders: JSON.parse(localStorage.getItem('reminders') || '[]'),
    
    // Initialize application
    init() {
        this.setupEventListeners();
        this.checkOnlineStatus();
        this.initializeTheme();
        this.setupKeyboardNavigation();
        this.loadUserSettings();
        this.hideLoadingOverlay();
        this.registerServiceWorker();
        
        console.log('MediTranslate+ initialized successfully');
    },
    
    // Setup global event listeners
    setupEventListeners() {
        // Online/Offline status
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));
        
        // Theme change detection
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.theme === 'auto') {
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
        
        // Visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkOnlineStatus();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Error handling
        window.addEventListener('error', (e) => this.handleError(e));
        window.addEventListener('unhandledrejection', (e) => this.handleError(e));
        
        // Performance monitoring
        window.addEventListener('load', () => this.trackPerformance());
    },
    
    // Update online/offline status
    updateOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        const statusElement = document.getElementById('offlineStatus');
        const onlineIcon = document.getElementById('onlineIcon');
        const offlineIcon = document.getElementById('offlineIcon');
        const statusText = statusElement?.querySelector('.status-text');
        
        if (statusElement) {
            if (isOnline) {
                onlineIcon?.classList.remove('d-none');
                offlineIcon?.classList.add('d-none');
                if (statusText) statusText.textContent = 'Online';
                statusElement.classList.add('text-success');
                statusElement.classList.remove('text-danger');
            } else {
                onlineIcon?.classList.add('d-none');
                offlineIcon?.classList.remove('d-none');
                if (statusText) statusText.textContent = 'Offline';
                statusElement.classList.add('text-danger');
                statusElement.classList.remove('text-success');
            }
        }
        
        // Show notification for status change
        if (document.readyState === 'complete') {
            this.showNotification(
                isOnline ? 'Back online!' : 'You are offline',
                isOnline ? 'success' : 'warning'
            );
        }
    },
    
    // Check current online status
    checkOnlineStatus() {
        this.updateOnlineStatus(navigator.onLine);
    },
    
    // Initialize theme system
    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    },
    
    // Set theme
    setTheme(theme) {
        this.theme = theme;
        localStorage.setItem('theme', theme);
        
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        
        // Update theme toggle button
        this.updateThemeToggle();
        
        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: theme }));
    },
    
    // Update theme toggle button appearance
    updateThemeToggle() {
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) {
            switch (this.theme) {
                case 'light':
                    themeIcon.className = 'fas fa-moon';
                    break;
                case 'dark':
                    themeIcon.className = 'fas fa-sun';
                    break;
                case 'auto':
                    themeIcon.className = 'fas fa-adjust';
                    break;
            }
        }
    },
    
    // Setup keyboard navigation
    setupKeyboardNavigation() {
        // Skip to content link
        const skipLink = document.createElement('a');
        skipLink.href = '#main';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to main content';
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Focus management for modals
        document.addEventListener('shown.bs.modal', (e) => {
            const firstInput = e.target.querySelector('input, button, textarea, select');
            if (firstInput) firstInput.focus();
        });
    },
    
    // Handle keyboard shortcuts
    handleKeyboardShortcuts(e) {
        // Alt + T: Toggle theme
        if (e.altKey && e.key === 't') {
            e.preventDefault();
            this.toggleTheme();
        }
        
        // Alt + H: Go to home
        if (e.altKey && e.key === 'h') {
            e.preventDefault();
            window.location.href = '/';
        }
        
        // Alt + S: Go to settings
        if (e.altKey && e.key === 's') {
            e.preventDefault();
            window.location.href = '/settings';
        }
        
        // Escape: Close modals
        if (e.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                const modal = bootstrap.Modal.getInstance(openModal);
                if (modal) modal.hide();
            }
        }
    },
    
    // Toggle theme
    toggleTheme() {
        const themes = ['light', 'dark', 'auto'];
        const currentIndex = themes.indexOf(this.theme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        this.setTheme(nextTheme);
    },
    
    // Load user settings
    loadUserSettings() {
        // Apply font size
        const fontSize = this.settings.fontSize || 'medium';
        document.documentElement.setAttribute('data-font-size', fontSize);
        
        // Apply high contrast if enabled
        if (this.settings.highContrast) {
            document.documentElement.setAttribute('data-theme', 'high-contrast');
        }
        
        // Apply reduced animations if preferred
        if (this.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.documentElement.style.setProperty('--animation-speed-fast', '0.01ms');
            document.documentElement.style.setProperty('--animation-speed-normal', '0.01ms');
            document.documentElement.style.setProperty('--animation-speed-slow', '0.01ms');
        }
    },
    
    // Hide loading overlay
    hideLoadingOverlay() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }, 1000);
        }
    },
    
    // Register service worker for PWA
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered successfully:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        }
    },
    
    // Show update notification
    showUpdateNotification() {
        const notification = this.createNotification(
            'App Update Available',
            'A new version of MediTranslate+ is available. Refresh to update.',
            'info',
            [
                {
                    text: 'Update Now',
                    action: () => window.location.reload()
                },
                {
                    text: 'Later',
                    action: () => {}
                }
            ]
        );
        document.body.appendChild(notification);
    },
    
    // Show notification
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 1050; min-width: 300px;';
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
    },
    
    // Create notification with actions
    createNotification(title, message, type = 'info', actions = []) {
        const notification = document.createElement('div');
        notification.className = `toast border-0 shadow-lg`;
        notification.setAttribute('role', 'alert');
        notification.innerHTML = `
            <div class="toast-header bg-${type} text-white border-0">
                <i class="fas fa-info-circle me-2"></i>
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
                ${actions.length > 0 ? `
                    <div class="mt-2 pt-2 border-top">
                        ${actions.map(action => `
                            <button type="button" class="btn btn-sm btn-outline-${type} me-2" 
                                    onclick="${action.action}">${action.text}</button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        
        // Position notification
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1060;';
        
        // Initialize Bootstrap toast
        setTimeout(() => {
            const bsToast = new bootstrap.Toast(notification);
            bsToast.show();
        }, 100);
        
        return notification;
    },
    
    // Handle errors
    handleError(error) {
        console.error('Application Error:', error);
        
        // Don't show error notifications for minor issues
        if (error.message && !error.message.includes('ResizeObserver') && 
            !error.message.includes('Non-Error promise rejection')) {
            this.showNotification(
                'An error occurred. Please try again or refresh the page.',
                'danger',
                5000
            );
        }
    },
    
    // Track performance metrics
    trackPerformance() {
        if ('performance' in window) {
            const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
            console.log(`Page load time: ${loadTime}ms`);
            
            // Track Core Web Vitals if available
            if ('web-vital' in window) {
                // Implementation would go here for actual tracking
            }
        }
    },
    
    // Utility functions
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
    },
    
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // API request wrapper
    async apiRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            
            if (!this.isOnline) {
                this.showNotification('You are offline. Please check your connection.', 'warning');
            } else {
                this.showNotification('Network error. Please try again.', 'danger');
            }
            
            throw error;
        }
    },
    
    // Local storage wrapper with error handling
    setStorageItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            this.showNotification('Failed to save data locally', 'warning');
        }
    },
    
    getStorageItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Failed to read from localStorage:', error);
            return defaultValue;
        }
    },
    
    // Format date for display
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    },
    
    // Animate scroll to element
    scrollToElement(elementId, offset = 0) {
        const element = document.getElementById(elementId);
        if (element) {
            const targetPosition = element.offsetTop - offset;
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        }
    },
    
    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied to clipboard!', 'success', 1500);
            return true;
        } catch (error) {
            console.error('Failed to copy text:', error);
            this.showNotification('Failed to copy text', 'danger');
            return false;
        }
    },
    
    // Share content using Web Share API
    async shareContent(data) {
        if (navigator.share) {
            try {
                await navigator.share(data);
                return true;
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Share failed:', error);
                }
                return false;
            }
        } else {
            // Fallback to copying to clipboard
            const shareText = `${data.title}\n${data.text}\n${data.url}`;
            return await this.copyToClipboard(shareText);
        }
    },
    
    // Check if PWA can be installed
    canInstallPWA() {
        return window.deferredPrompt !== null;
    },
    
    // Install PWA
    async installPWA() {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            window.deferredPrompt = null;
            return outcome === 'accepted';
        }
        return false;
    }
};

// Global functions accessible from HTML
window.toggleTheme = () => MediTranslate.toggleTheme();
window.toggleLanguage = () => {
    // Implementation for language toggle would go here
    console.log('Language toggle clicked');
};

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => MediTranslate.init());
} else {
    MediTranslate.init();
}

// PWA install prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    
    // Show install button if not already installed
    const installButton = document.getElementById('installButton');
    if (installButton) {
        installButton.style.display = 'block';
    }
});

// PWA install success
window.addEventListener('appinstalled', () => {
    window.deferredPrompt = null;
    MediTranslate.showNotification('MediTranslate+ installed successfully!', 'success');
});

// Export for use in other modules
window.MediTranslate = MediTranslate;
