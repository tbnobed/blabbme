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

// Push notification event
self.addEventListener('push', (event) => {
  console.log('🔔 Push event received in service worker:', event);
  
  let title = 'Blabb.me';
  let body = 'New message in chat';
  let data = {
    dateOfArrival: Date.now(),
    primaryKey: '1',
    url: '/'
  };
  
  // Parse JSON payload if available
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('📱 Parsed push payload:', payload);
      
      title = payload.title || title;
      body = payload.body || body;
      
      if (payload.roomId) {
        data.url = `/room/${payload.roomId}`;
        data.roomId = payload.roomId;
      }
      
      console.log('🎯 Showing notification:', { title, body, url: data.url });
    } catch (error) {
      console.error('❌ Error parsing push payload:', error);
      // Fallback to text content
      body = event.data.text() || body;
    }
  }

  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: data,
    tag: 'blabb-message', // Replace previous notifications
    requireInteraction: true, // Keep notification visible until user interacts
    actions: [
      {
        action: 'open',
        title: 'Open Chat',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('✅ Notification shown successfully');
      })
      .catch((error) => {
        console.error('❌ Error showing notification:', error);
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