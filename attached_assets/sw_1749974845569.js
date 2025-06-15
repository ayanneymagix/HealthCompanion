// MediTranslate+ Service Worker
// Provides offline functionality for healthcare app

const CACHE_NAME = 'meditranslate-v1.0.0';
const STATIC_CACHE = 'meditranslate-static-v1.0.0';
const API_CACHE = 'meditranslate-api-v1.0.0';
const IMAGE_CACHE = 'meditranslate-images-v1.0.0';

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/translator',
    '/chatbot',
    '/prescription',
    '/reminders',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/js/translator.js',
    '/static/js/chatbot.js',
    '/static/js/prescription.js',
    '/static/js/reminders.js',
    '/static/manifest.json',
    // Bootstrap and Font Awesome CDN files (will be cached when requested)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// API endpoints that can be cached
const CACHEABLE_API_ENDPOINTS = [
    '/api/offline-status'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {
                    mode: 'cors',
                    credentials: 'omit'
                })));
            }),
            
            // Initialize other caches
            caches.open(API_CACHE),
            caches.open(IMAGE_CACHE)
        ]).then(() => {
            console.log('Service Worker: Installation complete');
            // Force activation of new service worker
            return self.skipWaiting();
        }).catch(error => {
            console.error('Service Worker: Installation failed', error);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old cache versions
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== API_CACHE && 
                        cacheName !== IMAGE_CACHE &&
                        cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    try {
        // Strategy 1: Static assets (Cache First)
        if (isStaticAsset(url)) {
            return await cacheFirst(request, STATIC_CACHE);
        }
        
        // Strategy 2: API requests (Network First with fallback)
        if (isAPIRequest(url)) {
            return await networkFirstAPI(request);
        }
        
        // Strategy 3: Images (Cache First)
        if (isImageRequest(request)) {
            return await cacheFirst(request, IMAGE_CACHE);
        }
        
        // Strategy 4: HTML pages (Network First with offline fallback)
        if (isHTMLRequest(request)) {
            return await networkFirstHTML(request);
        }
        
        // Strategy 5: External resources (Stale While Revalidate)
        if (isExternalResource(url)) {
            return await staleWhileRevalidate(request, STATIC_CACHE);
        }
        
        // Default: Network only
        return await fetch(request);
        
    } catch (error) {
        console.error('Service Worker: Request failed', error);
        return await handleOfflineFallback(request);
    }
}

// Cache First Strategy - for static assets
async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Cache first failed', error);
        throw error;
    }
}

// Network First Strategy for API requests
async function networkFirstAPI(request) {
    const url = new URL(request.url);
    const cache = await caches.open(API_CACHE);
    
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful GET responses
        if (networkResponse.ok && request.method === 'GET') {
            // Only cache specific endpoints that are safe to cache
            if (CACHEABLE_API_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
                cache.put(request, networkResponse.clone());
            }
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed for API, trying cache', url.pathname);
        
        // Return cached response if available
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline API response
        return createOfflineAPIResponse(url);
    }
}

// Network First Strategy for HTML pages
async function networkFirstHTML(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed for HTML, trying cache');
        
        // Try to return cached version
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline page
        return createOfflineHTMLResponse(request);
    }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Fetch from network in background
    const networkPromise = fetch(request).then(response => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(error => {
        console.error('Service Worker: Background fetch failed', error);
    });
    
    // Return cached version immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // If no cached version, wait for network
    return await networkPromise;
}

// Helper functions to identify request types
function isStaticAsset(url) {
    const staticExtensions = ['.css', '.js', '.json', '.woff', '.woff2', '.ttf', '.eot'];
    const pathname = url.pathname.toLowerCase();
    
    return staticExtensions.some(ext => pathname.endsWith(ext)) ||
           pathname.startsWith('/static/');
}

function isAPIRequest(url) {
    return url.pathname.startsWith('/api/');
}

function isImageRequest(request) {
    return request.destination === 'image' ||
           request.headers.get('accept')?.includes('image/');
}

function isHTMLRequest(request) {
    return request.destination === 'document' ||
           request.headers.get('accept')?.includes('text/html');
}

function isExternalResource(url) {
    return url.origin !== self.location.origin;
}

// Create offline fallback responses
function createOfflineAPIResponse(url) {
    const pathname = url.pathname;
    
    // Specific offline responses for different API endpoints
    if (pathname.includes('/api/translate')) {
        return new Response(JSON.stringify({
            error: 'Translation service unavailable offline',
            offline: true,
            message: 'Please connect to the internet to use translation features'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (pathname.includes('/api/chat')) {
        return new Response(JSON.stringify({
            response: 'I am currently offline. Please connect to the internet to chat with me. For emergencies, call 108.',
            offline: true,
            language: 'en'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (pathname.includes('/api/scan-prescription')) {
        return new Response(JSON.stringify({
            error: 'OCR scanning requires internet connection',
            offline: true,
            message: 'Please connect to the internet or use manual entry'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    if (pathname.includes('/api/offline-status')) {
        return new Response(JSON.stringify({
            status: 'offline',
            features_available: ['reminders', 'manual_entry'],
            message: 'Limited functionality available offline'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Generic offline API response
    return new Response(JSON.stringify({
        error: 'Service unavailable offline',
        offline: true,
        message: 'This feature requires an internet connection'
    }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
    });
}

function createOfflineHTMLResponse(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Simple offline page
    const offlineHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - MediTranslate+</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
            color: #343a40;
            text-align: center;
        }
        .container {
            max-width: 600px;
            margin: 50px auto;
            padding: 40px 20px;
            background: white;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .icon {
            font-size: 4rem;
            color: #2E7D32;
            margin-bottom: 20px;
        }
        h1 {
            color: #2E7D32;
            margin-bottom: 20px;
        }
        .feature-list {
            text-align: left;
            margin: 30px 0;
        }
        .feature-item {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .available {
            color: #28a745;
        }
        .unavailable {
            color: #6c757d;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2E7D32;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin: 10px;
            font-weight: 600;
        }
        .emergency {
            background-color: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🏥</div>
        <h1>MediTranslate+ Offline</h1>
        <p>You're currently offline. Some features are still available:</p>
        
        <div class="feature-list">
            <div class="feature-item">
                <span class="available">✓ Medication Reminders</span> - View and manage your medication schedule
            </div>
            <div class="feature-item">
                <span class="available">✓ Manual Prescription Entry</span> - Add medications manually
            </div>
            <div class="feature-item">
                <span class="available">✓ Emergency Contacts</span> - Call emergency services
            </div>
            <div class="feature-item">
                <span class="unavailable">✗ AI Translation</span> - Requires internet connection
            </div>
            <div class="feature-item">
                <span class="unavailable">✗ Health Chatbot</span> - Requires internet connection
            </div>
            <div class="feature-item">
                <span class="unavailable">✗ Prescription Scanning</span> - Requires internet connection
            </div>
        </div>
        
        <div class="emergency">
            <strong>Emergency:</strong> For medical emergencies, call 108 immediately
            <br>
            <a href="tel:108" class="btn" style="background-color: white; color: #dc3545; margin-top: 10px;">
                📞 Call 108
            </a>
        </div>
        
        <a href="/" class="btn">Return to Home</a>
        <a href="/reminders" class="btn">View Reminders</a>
        
        <p style="margin-top: 30px; color: #6c757d; font-size: 0.9rem;">
            Connect to the internet to access all features
        </p>
    </div>
    
    <script>
        // Auto-refresh when back online
        window.addEventListener('online', function() {
            location.reload();
        });
        
        // Update status
        function updateStatus() {
            if (navigator.onLine) {
                location.reload();
            }
        }
        
        // Check connection periodically
        setInterval(updateStatus, 5000);
    </script>
</body>
</html>`;
    
    return new Response(offlineHTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
    });
}

// Handle offline fallback for any request
async function handleOfflineFallback(request) {
    // Try to return cached response
    const caches_to_check = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];
    
    for (const cacheName of caches_to_check) {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
    }
    
    // Return appropriate offline response
    if (isAPIRequest(new URL(request.url))) {
        return createOfflineAPIResponse(new URL(request.url));
    } else if (isHTMLRequest(request)) {
        return createOfflineHTMLResponse(request);
    } else {
        // For other resources, return a basic offline response
        return new Response('Offline - Resource not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Background sync for when connection is restored
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync triggered');
    
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Implement background sync logic here
            // For example, sync pending medication logs, translations, etc.
            handleBackgroundSync()
        );
    }
});

async function handleBackgroundSync() {
    try {
        // Example: Sync pending data when back online
        const pendingData = await getPendingData();
        
        for (const item of pendingData) {
            try {
                await syncDataItem(item);
            } catch (error) {
                console.error('Service Worker: Failed to sync item', error);
            }
        }
        
        console.log('Service Worker: Background sync completed');
    } catch (error) {
        console.error('Service Worker: Background sync failed', error);
    }
}

async function getPendingData() {
    // Get data that needs to be synced from IndexedDB or localStorage
    // This would include medication logs, translations, etc.
    return [];
}

async function syncDataItem(item) {
    // Sync individual data items with the server
    // Implementation would depend on the specific data type
    console.log('Service Worker: Syncing item', item);
}

// Push notification handler
self.addEventListener('push', event => {
    console.log('Service Worker: Push notification received');
    
    if (!event.data) {
        return;
    }
    
    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'MediTranslate+ notification',
            icon: '/static/icon-192.png',
            badge: '/static/badge-72.png',
            tag: data.tag || 'general',
            requireInteraction: data.requireInteraction || false,
            actions: data.actions || [],
            data: data.data || {}
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'MediTranslate+', options)
        );
    } catch (error) {
        console.error('Service Worker: Push notification error', error);
    }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};
    
    let url = '/';
    
    // Handle different notification types
    if (data.type === 'medication-reminder') {
        url = '/reminders';
    } else if (data.type === 'chat-message') {
        url = '/chatbot';
    } else if (action === 'open-app') {
        url = data.url || '/';
    }
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clientList => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url.includes(url) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});

// Message handler for communication with main app
self.addEventListener('message', event => {
    console.log('Service Worker: Message received', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;
            case 'GET_VERSION':
                event.ports[0].postMessage({ version: CACHE_NAME });
                break;
            case 'CLEAR_CACHE':
                clearAllCaches().then(() => {
                    event.ports[0].postMessage({ success: true });
                });
                break;
            default:
                console.log('Service Worker: Unknown message type', event.data.type);
        }
    }
});

async function clearAllCaches() {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('Service Worker: All caches cleared');
}

console.log('Service Worker: Script loaded successfully');
