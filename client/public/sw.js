// Service Worker for PWA functionality and push notifications
const CACHE_NAME = 'blabbme-v2'; // Force service worker update
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

// Production-grade push notification handler with multiple fallback strategies
self.addEventListener('push', (event) => {
  console.log('🔔 PUSH EVENT TRIGGERED - Production Handler v3.0');
  const timestamp = new Date().toISOString();
  console.log('🔔 Timestamp:', timestamp);
  console.log('🔔 Event data exists:', !!event.data);
  
  // CRITICAL: Confirm delivery to server with retry mechanism
  const confirmDelivery = async (attempt = 1) => {
    try {
      const response = await fetch('/api/push-delivered/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, attempt })
      });
      if (response.ok) {
        console.log(`✅ Delivery confirmed on attempt ${attempt}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e) {
      console.log(`📬 Delivery confirmation attempt ${attempt} failed:`, e);
      if (attempt < 3) {
        setTimeout(() => confirmDelivery(attempt + 1), 1000 * attempt);
      }
    }
  };
  
  confirmDelivery();
  
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

  // Production-grade notification with multiple fallback strategies
  const baseOptions = {
    body: body,
    tag: 'chat-message-' + Date.now(), // Unique tags prevent iOS grouping issues
    requireInteraction: true, // iOS requirement
    silent: false,
    timestamp: Date.now()
  };

  console.log('🔔 Production notification system:', title, baseOptions);

  // Multi-tier fallback strategy for maximum reliability
  const showNotificationWithFallbacks = async () => {
    const strategies = [
      // Strategy 1: Full notification with all options
      () => self.registration.showNotification(title, baseOptions),
      // Strategy 2: Minimal iOS-compatible notification
      () => self.registration.showNotification(title, {
        body: body,
        requireInteraction: true
      }),
      // Strategy 3: Absolute fallback
      () => self.registration.showNotification('New Message', {
        body: 'Chat message received'
      }),
      // Strategy 4: Emergency fallback with just title
      () => self.registration.showNotification('Blabb.me')
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`🔔 Attempting notification strategy ${i + 1}...`);
        await strategies[i]();
        console.log(`✅ NOTIFICATION SUCCESS on strategy ${i + 1}`);
        return;
      } catch (error) {
        console.error(`❌ Strategy ${i + 1} failed:`, error);
        if (i === strategies.length - 1) {
          console.error('💥 ALL NOTIFICATION STRATEGIES FAILED');
          throw error;
        }
      }
    }
  };

  event.waitUntil(
    showNotificationWithFallbacks()
      .then(() => {
        console.log('🎉 PRODUCTION NOTIFICATION COMPLETED SUCCESSFULLY');
      })
      .catch((finalError) => {
        console.error('💀 CRITICAL: All notification fallbacks exhausted:', finalError);
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