// MediTranslate+ Service Worker for PWA functionality

const CACHE_NAME = 'meditranslate-v2.0.0';
const STATIC_CACHE = 'meditranslate-static-v2.0.0';
const DYNAMIC_CACHE = 'meditranslate-dynamic-v2.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/static/css/style.css',
    '/static/css/themes.css',
    '/static/css/animations.css',
    '/static/js/app.js',
    '/static/js/theme.js',
    '/static/js/animations.js',
    '/static/js/translator.js',
    '/static/js/chatbot.js',
    '/static/js/prescription.js',
    '/static/js/reminders.js',
    '/static/js/settings.js',
    '/static/manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// API endpoints that should be cached
const API_CACHE_PATTERNS = [
    '/translate',
    '/chat',
    '/get_settings'
];

// Install event - cache static resources
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES.map(url => new Request(url, { credentials: 'same-origin' })));
            })
        ]).then(() => {
            console.log('Service Worker installed successfully');
            return self.skipWaiting();
        }).catch(error => {
            console.error('Service Worker installation failed:', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Handle API requests
    if (isApiRequest(request)) {
        event.respondWith(handleApiRequest(request));
        return;
    }
    
    // Handle static file requests
    if (isStaticFile(request)) {
        event.respondWith(handleStaticRequest(request));
        return;
    }
    
    // Handle navigation requests
    if (isNavigationRequest(request)) {
        event.respondWith(handleNavigationRequest(request));
        return;
    }
    
    // Default fetch for other requests
    event.respondWith(fetch(request));
});

// Check if request is for API
function isApiRequest(request) {
    const url = new URL(request.url);
    return API_CACHE_PATTERNS.some(pattern => url.pathname.startsWith(pattern));
}

// Check if request is for static file
function isStaticFile(request) {
    const url = new URL(request.url);
    return url.pathname.startsWith('/static/') || 
           url.hostname !== location.hostname ||
           STATIC_FILES.includes(url.pathname);
}

// Check if request is navigation
function isNavigationRequest(request) {
    return request.mode === 'navigate' || 
           (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// Handle API requests with cache-first strategy for translations
async function handleApiRequest(request) {
    const url = new URL(request.url);
    
    try {
        // For translation requests, try cache first
        if (url.pathname === '/translate') {
            const cachedResponse = await getCachedTranslation(request);
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        
        // Try network first
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache successful API responses
            if (url.pathname === '/translate' || url.pathname === '/get_settings') {
                const cache = await caches.open(DYNAMIC_CACHE);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        }
        
        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline response for specific endpoints
        return getOfflineApiResponse(url.pathname);
        
    } catch (error) {
        console.log('API request failed, trying cache:', error);
        
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return getOfflineApiResponse(url.pathname);
    }
}

// Handle static file requests
async function handleStaticRequest(request) {
    try {
        // Try cache first for static files
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If not in cache, try network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            // Cache the response
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.log('Static file request failed:', error);
        
        // Try cache one more time
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return a basic fallback
        return new Response('Resource not available offline', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Handle navigation requests
async function handleNavigationRequest(request) {
    try {
        // Try network first for navigation
        const networkResponse = await fetch(request);
        return networkResponse;
        
    } catch (error) {
        console.log('Navigation request failed, serving offline page:', error);
        
        // Try to serve cached page
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Serve offline fallback
        const offlinePage = await caches.match('/');
        if (offlinePage) {
            return offlinePage;
        }
        
        // Ultimate fallback
        return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>MediTranslate+ - Offline</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .offline-message { max-width: 500px; margin: 0 auto; }
                    .icon { font-size: 4rem; color: #2E7D32; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="offline-message">
                    <div class="icon">🏥</div>
                    <h1>MediTranslate+</h1>
                    <h2>You're Offline</h2>
                    <p>Please check your internet connection and try again.</p>
                    <button onclick="window.location.reload()">Try Again</button>
                </div>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

// Get cached translation based on request
async function getCachedTranslation(request) {
    // For POST requests, we can't directly cache them
    // But we can implement a simple key-based cache for translations
    if (request.method === 'POST') {
        try {
            const requestBody = await request.clone().text();
            const data = JSON.parse(requestBody);
            
            // Create a cache key based on text and languages
            const cacheKey = `translation_${data.source_lang}_${data.target_lang}_${hashString(data.text)}`;
            
            const cache = await caches.open(DYNAMIC_CACHE);
            const cachedResponse = await cache.match(`/cached-translation/${cacheKey}`);
            
            return cachedResponse;
        } catch (error) {
            console.log('Error checking cached translation:', error);
            return null;
        }
    }
    
    return null;
}

// Generate offline API responses
function getOfflineApiResponse(pathname) {
    switch (pathname) {
        case '/translate':
            return new Response(JSON.stringify({
                success: false,
                error: 'Translation service unavailable offline. Please check your connection.',
                offline: true
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503
            });
            
        case '/chat':
            return new Response(JSON.stringify({
                success: false,
                error: 'AI assistant unavailable offline. For medical emergencies, call 108.',
                offline: true
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503
            });
            
        case '/scan_prescription':
            return new Response(JSON.stringify({
                success: false,
                error: 'Prescription scanning unavailable offline. Try manual entry.',
                offline: true
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503
            });
            
        case '/get_settings':
            // Return default settings when offline
            return new Response(JSON.stringify({
                success: true,
                settings: {
                    theme: 'light',
                    language: 'en',
                    voice_enabled: true,
                    notifications_enabled: true,
                    settings_data: {}
                }
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
            
        default:
            return new Response(JSON.stringify({
                success: false,
                error: 'Service unavailable offline',
                offline: true
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 503
            });
    }
}

// Simple hash function for cache keys
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

// Background sync for offline actions
self.addEventListener('sync', event => {
    console.log('Background sync triggered:', event.tag);
    
    if (event.tag === 'background-translation') {
        event.waitUntil(syncTranslations());
    }
    
    if (event.tag === 'background-chat') {
        event.waitUntil(syncChatMessages());
    }
});

// Sync pending translations when back online
async function syncTranslations() {
    try {
        // Get pending translations from IndexedDB or localStorage
        const pendingTranslations = JSON.parse(localStorage.getItem('pendingTranslations') || '[]');
        
        for (const translation of pendingTranslations) {
            try {
                const response = await fetch('/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(translation)
                });
                
                if (response.ok) {
                    // Remove from pending list
                    const index = pendingTranslations.indexOf(translation);
                    pendingTranslations.splice(index, 1);
                }
            } catch (error) {
                console.log('Failed to sync translation:', error);
            }
        }
        
        localStorage.setItem('pendingTranslations', JSON.stringify(pendingTranslations));
        
    } catch (error) {
        console.log('Background sync failed:', error);
    }
}

// Sync pending chat messages when back online
async function syncChatMessages() {
    try {
        const pendingChats = JSON.parse(localStorage.getItem('pendingChats') || '[]');
        
        for (const chat of pendingChats) {
            try {
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chat)
                });
                
                if (response.ok) {
                    const index = pendingChats.indexOf(chat);
                    pendingChats.splice(index, 1);
                }
            } catch (error) {
                console.log('Failed to sync chat message:', error);
            }
        }
        
        localStorage.setItem('pendingChats', JSON.stringify(pendingChats));
        
    } catch (error) {
        console.log('Chat sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', event => {
    console.log('Push notification received');
    
    const options = {
        body: 'Time to take your medication!',
        icon: '/static/manifest.json',
        badge: '/static/manifest.json',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 'medication-reminder'
        },
        actions: [
            {
                action: 'taken',
                title: 'Mark as Taken',
                icon: '/static/images/check-icon.png'
            },
            {
                action: 'snooze',
                title: 'Snooze 15min',
                icon: '/static/images/snooze-icon.png'
            }
        ]
    };
    
    if (event.data) {
        const notificationData = event.data.json();
        options.body = notificationData.body || options.body;
        options.data = { ...options.data, ...notificationData };
    }
    
    event.waitUntil(
        self.registration.showNotification('MediTranslate+ Reminder', options)
    );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event.action);
    
    event.notification.close();
    
    if (event.action === 'taken') {
        // Handle medication taken
        event.waitUntil(
            clients.openWindow('/reminders?action=taken')
        );
    } else if (event.action === 'snooze') {
        // Handle snooze
        console.log('Medication reminder snoozed');
    } else {
        // Default action - open app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Message handling from main thread
self.addEventListener('message', event => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CACHE_TRANSLATION') {
        cacheTranslation(event.data.translation);
    }
});

// Cache a translation result
async function cacheTranslation(translationData) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const cacheKey = `translation_${translationData.source_lang}_${translationData.target_lang}_${hashString(translationData.text)}`;
        
        const response = new Response(JSON.stringify({
            success: true,
            translated_text: translationData.translated_text,
            source_lang: translationData.source_lang,
            target_lang: translationData.target_lang
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
        
        await cache.put(`/cached-translation/${cacheKey}`, response);
        console.log('Translation cached successfully');
        
    } catch (error) {
        console.log('Failed to cache translation:', error);
    }
}

// Periodic background tasks
self.addEventListener('periodicsync', event => {
    if (event.tag === 'medication-check') {
        event.waitUntil(checkMedicationReminders());
    }
});

// Check for due medication reminders
async function checkMedicationReminders() {
    try {
        // This would typically fetch from a server or check local storage
        const reminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
        const now = new Date();
        
        reminders.forEach(reminder => {
            if (reminder.time_slots) {
                reminder.time_slots.forEach(timeSlot => {
                    const [hours, minutes] = timeSlot.split(':').map(Number);
                    const reminderTime = new Date();
                    reminderTime.setHours(hours, minutes, 0, 0);
                    
                    // Check if reminder is due (within 1 minute)
                    const timeDiff = Math.abs(now.getTime() - reminderTime.getTime());
                    if (timeDiff < 60000) { // 1 minute tolerance
                        self.registration.showNotification('Medication Reminder', {
                            body: `Time to take ${reminder.medication_name} - ${reminder.dosage}`,
                            icon: '/static/manifest.json',
                            badge: '/static/manifest.json',
                            tag: `medication-${reminder.id}`,
                            requireInteraction: true,
                            actions: [
                                { action: 'taken', title: 'Taken' },
                                { action: 'snooze', title: 'Snooze' }
                            ]
                        });
                    }
                });
            }
        });
        
    } catch (error) {
        console.log('Failed to check medication reminders:', error);
    }
}
