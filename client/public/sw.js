// Service Worker for PWA functionality and push notifications
const CACHE_NAME = 'blabbme-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Push notification event - iOS compatible version
self.addEventListener('push', (event) => {
  console.log('🔔 Push event received');
  
  // Simple, iOS-compatible notification
  let title = 'New Message';
  let body = 'You have a new chat message';
  
  // Try to parse payload but don't fail if it doesn't work
  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      body = payload.body || body;
    } catch (error) {
      // Fallback to simple text
      try {
        body = event.data.text() || body;
      } catch (e) {
        // Use default
      }
    }
  }

  // Minimal options for iOS compatibility
  const options = {
    body: body,
    icon: '/icon-192.png',
    data: { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch(() => {
        // Ultimate fallback
        return self.registration.showNotification('New Message', {
          body: 'You have a new message'
        });
      })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.notification.data);
  event.notification.close();

  // Get the URL to open (either the stored URL or default to home)
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    // Try to focus existing client first
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window open with the same URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no existing window found, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }).catch((error) => {
      console.log('Error handling notification click:', error);
      // Fallback: just try to open the URL
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Background sync for messages when app regains connectivity
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Sync pending messages or reconnect to chat
      fetch('/api/sync').catch(() => console.log('Sync failed'))
    );
  }
});