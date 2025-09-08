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

// Push notification event - iOS Safari PWA compatible version  
self.addEventListener('push', (event) => {
  console.log('🔔 PUSH EVENT TRIGGERED in service worker');
  console.log('🔔 Timestamp:', new Date().toISOString());
  console.log('🔔 Event data exists:', !!event.data);
  
  // Confirm delivery to server (this proves service worker got the push)
  try {
    fetch('/api/push-delivered/current', { method: 'POST' }).catch(e => 
      console.log('📬 Delivery confirmation failed:', e)
    );
  } catch (e) {
    console.log('📬 Fetch error:', e);
  }
  
  // Default notification for iOS Safari PWA
  let title = 'New Chat Message';
  let body = 'You have a new message in Blabb.me';
  let icon = undefined; // iOS Safari doesn't like icons
  let badge = undefined; // iOS Safari doesn't like badges  
  
  // Try to extract message content for better notification
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('🔔 Push payload:', payload);
      
      if (payload.message) {
        const msg = payload.message;
        title = `${msg.nickname} in chat`;
        body = msg.content;
      } else if (payload.title && payload.body) {
        title = payload.title;
        body = payload.body;
      }
    } catch (error) {
      console.log('🔔 Payload parse failed, using defaults:', error);
    }
  } else {
    console.log('🔔 No payload data - showing default notification');
  }

  // iOS Safari PWA requires specific notification options
  const options = {
    body: body,
    tag: 'chat-message', // Prevents duplicate notifications
    requireInteraction: true, // iOS needs this to show properly
    silent: false, // Make sure it's not silent
    // Don't include icon, badge, or complex data for iOS compatibility
  };

  console.log('🔔 Showing notification:', title, options);

  // Force show notification immediately - iOS Safari is very strict about timing
  event.waitUntil(
    Promise.resolve()
      .then(() => {
        console.log('🔔 About to call showNotification...');
        return self.registration.showNotification(title, options);
      })
      .then(() => {
        console.log('✅ NOTIFICATION DISPLAYED SUCCESSFULLY');
      })
      .catch((error) => {
        console.error('❌ NOTIFICATION FAILED:', error);
        // iOS fallback - absolutely minimal notification
        return self.registration.showNotification('Chat Message', {
          body: 'New message received',
          requireInteraction: true
        }).then(() => {
          console.log('✅ FALLBACK NOTIFICATION SHOWN');
        }).catch((fallbackError) => {
          console.error('💥 EVEN FALLBACK FAILED:', fallbackError);
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