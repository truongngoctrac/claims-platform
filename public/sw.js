const CACHE_NAME = 'healthcare-claims-v2.0.0';
const STATIC_CACHE_NAME = 'static-resources-v2.0.0';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v2.0.0';
const API_CACHE_NAME = 'api-responses-v2.0.0';

// Resources to cache immediately
const STATIC_RESOURCES = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/static/js/bundle.js',
  '/static/css/main.css',
  // Add more static resources as needed
];

// API endpoints that should be cached
const CACHED_API_PATTERNS = [
  /\/api\/claims/,
  /\/api\/users/,
  /\/api\/hospitals/,
  /\/api\/analytics/
];

// Network-first patterns (always try network first)
const NETWORK_FIRST_PATTERNS = [
  /\/api\/auth/,
  /\/api\/notifications/,
  /\/api\/real-time/
];

// Cache-first patterns (check cache first, then network)
const CACHE_FIRST_PATTERNS = [
  /\.(js|css|woff2?|png|jpg|jpeg|svg|ico)$/,
  /\/static\//
];

// Maximum cache sizes
const MAX_CACHE_SIZES = {
  [STATIC_CACHE_NAME]: 50,
  [DYNAMIC_CACHE_NAME]: 100,
  [API_CACHE_NAME]: 200
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  [API_CACHE_NAME]: 5 * 60 * 1000, // 5 minutes
  [DYNAMIC_CACHE_NAME]: 24 * 60 * 60 * 1000, // 24 hours
  [STATIC_CACHE_NAME]: 7 * 24 * 60 * 60 * 1000 // 7 days
};

// Install event
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[ServiceWorker] Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME) {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all pages
      self.clients.claim()
    ])
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (url.pathname.startsWith('/api/')) {
    // API requests
    event.respondWith(handleApiRequest(request));
  } else if (CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    // Static resources - cache first
    event.respondWith(handleCacheFirst(request));
  } else if (url.pathname === '/' || url.pathname.includes('.html')) {
    // HTML pages - network first with cache fallback
    event.respondWith(handleNetworkFirst(request));
  } else {
    // Everything else - network first
    event.respondWith(handleNetworkFirst(request));
  }
});

// Handle API requests with intelligent caching
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Network-first for critical APIs
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return handleNetworkFirst(request, API_CACHE_NAME);
  }
  
  // Cache-first for cacheable APIs
  if (CACHED_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return handleCacheFirst(request, API_CACHE_NAME);
  }
  
  // Default to network-only for unconfigured APIs
  return fetch(request);
}

// Cache-first strategy
async function handleCacheFirst(request, cacheName = STATIC_CACHE_NAME) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, cacheName)) {
      // Return cached version and update in background
      updateCacheInBackground(request, cache);
      return cachedResponse;
    }
    
    // Fetch from network
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Clone response before caching
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await trimCache(cacheName);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Cache-first failed:', error);
    
    // Try to return cached version even if expired
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Network-first strategy
async function handleNetworkFirst(request, cacheName = DYNAMIC_CACHE_NAME) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache successful responses
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      await trimCache(cacheName);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, trying cache:', error);
    
    // Fallback to cache
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's a navigation request and we have an offline page
    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// Update cache in background
async function updateCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse);
    }
  } catch (error) {
    console.log('[ServiceWorker] Background update failed:', error);
  }
}

// Check if cached response is expired
function isExpired(response, cacheName) {
  const cachedDate = response.headers.get('sw-cached-date');
  if (!cachedDate) return false;
  
  const cacheTime = new Date(cachedDate).getTime();
  const now = Date.now();
  const expiration = CACHE_EXPIRATION[cacheName] || CACHE_EXPIRATION[DYNAMIC_CACHE_NAME];
  
  return (now - cacheTime) > expiration;
}

// Trim cache to maximum size
async function trimCache(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const maxSize = MAX_CACHE_SIZES[cacheName] || 50;
  
  if (keys.length > maxSize) {
    // Remove oldest entries
    const entriesToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(entriesToDelete.map(key => cache.delete(key)));
  }
}

// Background sync
self.addEventListener('sync', (event) => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'claim-submission') {
    event.waitUntil(syncClaimSubmissions());
  } else if (event.tag === 'analytics') {
    event.waitUntil(syncAnalytics());
  }
});

// Sync claim submissions when back online
async function syncClaimSubmissions() {
  try {
    // Get pending submissions from IndexedDB
    const pendingSubmissions = await getPendingSubmissions();
    
    for (const submission of pendingSubmissions) {
      try {
        const response = await fetch('/api/claims', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(submission.data)
        });
        
        if (response.ok) {
          // Remove from pending queue
          await removePendingSubmission(submission.id);
          
          // Notify user of success
          self.registration.showNotification('Hồ sơ đã được nộp thành công', {
            body: `Hồ sơ ${submission.data.claimId} đã được gửi khi kết nối mạng phục hồi.`,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            tag: 'claim-sync-success',
            requireInteraction: true
          });
        }
      } catch (error) {
        console.log('[ServiceWorker] Failed to sync submission:', error);
      }
    }
  } catch (error) {
    console.log('[ServiceWorker] Sync failed:', error);
  }
}

// Sync analytics data
async function syncAnalytics() {
  try {
    const pendingAnalytics = await getPendingAnalytics();
    
    for (const event of pendingAnalytics) {
      try {
        const response = await fetch('/api/analytics/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event.data)
        });
        
        if (response.ok) {
          await removePendingAnalytics(event.id);
        }
      } catch (error) {
        console.log('[ServiceWorker] Failed to sync analytics:', error);
      }
    }
  } catch (error) {
    console.log('[ServiceWorker] Analytics sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push received');
  
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'Bạn có thông báo mới',
    icon: data.icon || '/icon-192x192.png',
    badge: '/badge-72x72.png',
    image: data.image,
    data: data.data,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Thông báo mới', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if no existing window found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handling
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Utility functions for IndexedDB operations
async function getPendingSubmissions() {
  // Implementation would use IndexedDB to store/retrieve pending submissions
  return [];
}

async function removePendingSubmission(id) {
  // Implementation would remove submission from IndexedDB
}

async function getPendingAnalytics() {
  // Implementation would use IndexedDB to store/retrieve pending analytics
  return [];
}

async function removePendingAnalytics(id) {
  // Implementation would remove analytics from IndexedDB
}

// Cache update notification
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_CACHE') {
    console.log('[ServiceWorker] Updating cache...');
    
    // Force update of critical resources
    event.waitUntil(
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_RESOURCES);
      })
    );
  }
});

console.log('[ServiceWorker] Loaded with intelligent caching strategies');
