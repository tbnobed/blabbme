import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Download, AlertCircle } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const [pwaCriteria, setPwaCriteria] = useState({
    manifest: false,
    serviceWorker: false,
    https: false
  });

  useEffect(() => {
    const handler = (e: Event) => {
      console.log('beforeinstallprompt event fired');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event so it can be triggered later
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check PWA criteria
    const checkPWACriteria = async () => {
      const criteria = {
        manifest: false,
        serviceWorker: false,
        https: location.protocol === 'https:' || location.hostname === 'localhost'
      };

      console.log('Checking PWA criteria...');
      console.log('Protocol:', location.protocol);
      console.log('Hostname:', location.hostname);
      console.log('HTTPS check:', criteria.https);

      // Check manifest - try both inline and file approaches
      try {
        const manifestLinks = document.querySelectorAll('link[rel="manifest"]');
        console.log('Found manifest links:', manifestLinks.length);
        
        if (manifestLinks.length > 0) {
          criteria.manifest = true;
          console.log('Manifest found in HTML');
        } else {
          const manifestResponse = await fetch('/manifest.json');
          criteria.manifest = manifestResponse.ok;
          console.log('Manifest fetch result:', manifestResponse.status);
        }
      } catch (error) {
        console.log('Manifest check failed:', error);
      }

      // Register dynamic service worker and check
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/api/sw.js');
          console.log('Dynamic SW registered:', registration);
          criteria.serviceWorker = true;
          
          // Set up push notifications after service worker is ready
          setupPushNotifications(registration);
        } catch (error) {
          console.log('SW registration failed:', error);
        }
      }

      setPwaCriteria(criteria);
      console.log('PWA Criteria:', criteria);

      // Show manual instructions after 5 seconds if no install prompt appeared
      setTimeout(() => {
        if (!deferredPrompt && criteria.https && criteria.manifest && criteria.serviceWorker) {
          console.log('PWA criteria met but no install prompt - showing manual instructions');
          setShowManualInstructions(true);
        } else {
          console.log('PWA criteria not met:', criteria);
        }
      }, 5000);
    };

    checkPWACriteria();

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Setup push notifications
  const setupPushNotifications = async (registration: ServiceWorkerRegistration) => {
    try {
      // Check if user has granted notification permission
      if (Notification.permission !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      // Get the public VAPID key
      const response = await fetch('/api/vapid-public-key');
      const { publicKey } = await response.json();
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Get current session ID
      const sessionResponse = await fetch('/api/session/current');
      const sessionData = await sessionResponse.json();
      
      if (sessionData.sessionId) {
        // Send subscription to server
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionData.sessionId,
            subscription: subscription.toJSON()
          }),
        });
        
        console.log('Push notifications set up successfully');
      }
    } catch (error) {
      console.log('Failed to setup push notifications:', error);
    }
  };

  // Helper function to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt so it can only be used once
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Remember user dismissed it for this session
    sessionStorage.setItem('installPromptDismissed', 'true');
  };

  // Don't show if user already dismissed or app is installed
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
  const isDismissed = sessionStorage.getItem('installPromptDismissed');
  
  if (isInstalled) {
    return null; // Already installed
  }

  // Show automatic install prompt if available
  if (showPrompt && !isDismissed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <Download className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Install Blabb.me
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Add to your home screen for quick access and notifications
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                onClick={handleInstall}
                size="sm"
                className="text-xs px-3 py-1"
              >
                Install
              </Button>
              <Button 
                onClick={handleDismiss}
                variant="outline"
                size="sm"
                className="text-xs px-3 py-1"
              >
                Not now
              </Button>
            </div>
          </div>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="p-1 h-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Show manual installation instructions if criteria are met but no auto-prompt
  if (showManualInstructions && !isDismissed && pwaCriteria.manifest && pwaCriteria.serviceWorker) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg shadow-lg p-4 max-w-sm mx-auto">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Add to Home Screen
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              In Safari: tap Share → Add to Home Screen for app-like experience with notifications
            </p>
            <div className="flex gap-2 mt-3">
              <Button 
                onClick={handleDismiss}
                variant="outline"
                size="sm"
                className="text-xs px-3 py-1"
              >
                Got it
              </Button>
            </div>
          </div>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="p-1 h-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return null;
}