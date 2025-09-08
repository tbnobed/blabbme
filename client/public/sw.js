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

// Push notification event - iOS compatible version with extensive debugging
self.addEventListener('push', (event) => {
  console.log('🔔 Push event received in service worker');
  console.log('🔔 Event data exists:', !!event.data);
  console.log('🔔 User agent:', navigator.userAgent);
  console.log('🔔 Is iOS:', /iPhone|iPad|iPod/.test(navigator.userAgent));
  console.log('🔔 Timestamp:', new Date().toISOString());
  
  // Force show a notification even without data to test iOS handling
  if (!event.data) {
    console.log('🔔 No data received, showing test notification');
    event.waitUntil(
      self.registration.showNotification('Test Push', {
        body: 'Push received but no data',
        tag: 'test-push'
      })
    );
    return;
  }
  
  // Simple, iOS-compatible notification
  let title = 'Blabb.me';
  let body = 'You have a new chat message';
  let data = {};
  
  // Try to parse payload but don't fail if it doesn't work
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('🔔 Parsed payload:', payload);
      title = payload.title || title;
      body = payload.body || body;
      data = payload;
    } catch (error) {
      console.log('🔔 JSON parse failed, trying text:', error);
      // Fallback to simple text
      try {
        const textData = event.data.text();
        console.log('🔔 Text data:', textData);
        body = textData || body;
      } catch (e) {
        console.log('🔔 Text parse also failed:', e);
      }
    }
  }

  console.log('🔔 Final notification:', { title, body });

  // Ultra-simple options for iOS compatibility - no icon that might fail
  const options = {
    body: body,
    tag: 'blabbme-message',
    requireInteraction: false,
    silent: false,
    data: data
  };

  console.log('🔔 Showing notification with options:', options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('✅ Notification shown successfully');
      })
      .catch((error) => {
        console.error('❌ Notification failed:', error);
        // Ultimate fallback - absolute minimal notification
        return self.registration.showNotification('New Message', {
          body: 'Chat message received'
        }).then(() => {
          console.log('✅ Fallback notification shown');
        }).catch((fallbackError) => {
          console.error('❌ Even fallback failed:', fallbackError);
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