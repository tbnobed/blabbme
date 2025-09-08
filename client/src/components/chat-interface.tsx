import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Share, LogOut, Send, Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRModal from "./qr-modal";

interface Message {
  id: number;
  nickname: string;
  content: string;
  timestamp: Date;
  isFiltered?: boolean;
}

interface Participant {
  id: number;
  nickname: string;
  socketId: string;
  joinedAt: Date;
}

interface Room {
  id: string;
  name: string;
  participantCount?: number;
  maxParticipants?: number;
}

interface ChatInterfaceProps {
  roomId: string;
  nickname: string;
  socket: WebSocket | null;
  onLeaveRoom: () => void;
}

export default function ChatInterface({ roomId, nickname, socket, onLeaveRoom }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);
  const [warning, setWarning] = useState("");
  // Initialize notification state - auto-enable for new users
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('notificationsEnabled');
    console.log('🔔 Initializing notifications from localStorage:', saved);
    // Auto-enable for new users (no previous preference), respect existing choice
    return saved !== 'false';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('soundEnabled');
    return saved !== 'false'; // Default to true
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Setup push notifications
  const setupPushNotifications = async () => {
    try {
      console.log('🔔 Starting push notification setup...');
      console.log('📱 Notifications enabled:', notificationsEnabled);
      console.log('📱 Is iOS:', /iPhone|iPad|iPod/.test(navigator.userAgent));
      console.log('📱 Is standalone mode:', window.matchMedia('(display-mode: standalone)').matches);
      console.log('📱 User agent:', navigator.userAgent);
      console.log('📱 Service worker support:', 'serviceWorker' in navigator);
      console.log('📱 Push manager support:', 'PushManager' in window);
      
      if (!notificationsEnabled) {
        console.log('❌ Notifications not enabled, skipping push setup');
        return;
      }

      if (!('serviceWorker' in navigator)) {
        console.log('❌ Service worker not supported');
        return;
      }

      // Wait for service worker to be truly ready with timeout
      console.log('📱 Waiting for service worker to be ready...');
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker timeout')), 10000))
      ]) as ServiceWorkerRegistration;
      console.log('✅ Service worker ready for push setup');
      
      // Get the public VAPID key
      const response = await fetch('/api/vapid-public-key');
      const { publicKey } = await response.json();
      
      // Check if push manager is available (crucial for iOS)
      if (!registration.pushManager) {
        console.log('❌ Push manager not available');
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
          console.log('📱 iOS: Push requires PWA to be installed (added to home screen)');
        }
        return;
      }
      
      console.log('✅ Push manager available');
      console.log('📱 VAPID public key:', publicKey);
      
      // Convert VAPID key with error handling
      let applicationServerKey;
      try {
        applicationServerKey = urlBase64ToUint8Array(publicKey);
        console.log('✅ VAPID key converted successfully');
      } catch (error) {
        console.log('❌ VAPID key conversion failed:', error);
        return;
      }
      
      console.log('📱 Subscribing to push notifications...');
      console.log('📱 iOS Check - User agent:', navigator.userAgent);
      console.log('📱 iOS Check - Standalone mode:', window.matchMedia('(display-mode: standalone)').matches);
      console.log('📱 iOS Check - Push manager exists:', !!registration.pushManager);
      console.log('📱 iOS Check - Notification permission:', Notification.permission);
      
      // Subscribe to push notifications with detailed iOS debugging
      let subscription;
      try {
        console.log('📱 Starting push subscription with options:', {
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey ? 'present' : 'missing'
        });
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        
        console.log('✅ Push subscription created successfully');
        console.log('📱 Subscription endpoint:', subscription.endpoint);
        console.log('📱 Subscription keys present:', !!subscription.getKey);
        
      } catch (error) {
        console.error('❌ Push subscription failed with error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
          console.error('📱 iOS SPECIFIC ERROR - Push subscription failed');
          console.error('📱 This could be due to:');
          console.error('📱 1. Safari version incompatibility');
          console.error('📱 2. PWA not properly installed');
          console.error('📱 3. iOS notifications not enabled at system level');
          console.error('📱 4. VAPID key format issue on iOS');
          
          // Try to get more specific error info
          if (error.name === 'NotSupportedError') {
            console.error('📱 NotSupportedError: Push is not supported on this iOS version/setup');
          } else if (error.name === 'NotAllowedError') {
            console.error('📱 NotAllowedError: User denied push permission or not in standalone mode');
          } else if (error.name === 'AbortError') {
            console.error('📱 AbortError: Subscription request was aborted');
          }
        }
        return;
      }

      // Get current session ID
      const sessionResponse = await fetch('/api/session/current');
      const sessionData = await sessionResponse.json();
      
      if (sessionData.sessionId) {
        console.log('📱 Sending subscription to server...');
        console.log('📱 Session ID for registration:', sessionData.sessionId);
        console.log('📱 Subscription endpoint:', subscription.endpoint);
        
        // Send subscription to server - server expects the subscription directly
        const subscribeResponse = await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription.toJSON()),
          credentials: 'include' // Important for session-based auth
        });
        
        console.log('📱 Server response status:', subscribeResponse.status);
        
        if (subscribeResponse.ok) {
          const responseData = await subscribeResponse.json();
          console.log('✅ Server response data:', responseData);
          console.log('✅ Push notifications set up successfully for room:', roomId);
          if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            console.log('📱 iOS: Push notifications should now work when app is backgrounded');
          }
        } else {
          const errorText = await subscribeResponse.text();
          console.error('❌ Server registration failed:', subscribeResponse.status, errorText);
          throw new Error(`Server registration failed: ${subscribeResponse.status} - ${errorText}`);
        }
      }
    } catch (error) {
      console.log('❌ Failed to setup push notifications:', error);
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        console.log('📱 iOS debugging - error details:', {
          errorName: error.name,
          errorMessage: error.message,
          isStandalone: window.matchMedia('(display-mode: standalone)').matches,
          serviceWorkerSupport: 'serviceWorker' in navigator,
          pushManagerSupport: 'PushManager' in window,
          notificationPermission: Notification.permission
        });
      }
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

  // Request notification permission when component mounts
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window) {
        console.log('🔔 Setting up notifications for chat...');
        console.log('📱 User agent:', navigator.userAgent);
        console.log('📱 Is iOS:', /iPhone|iPad|iPod/.test(navigator.userAgent));
        console.log('📱 Is Safari:', /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent));
        console.log('📱 Display mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
        console.log('📱 PWA installed:', window.matchMedia('(display-mode: standalone)').matches);
        
        const permission = await Notification.requestPermission();
        const enabled = permission === 'granted';
        setNotificationsEnabled(enabled);
        localStorage.setItem('notificationsEnabled', enabled.toString());
        console.log('🔔 Notification permission:', permission);
        
        // Setup push notifications after permission is granted
        if (permission === 'granted') {
          console.log('✅ Permission granted, setting up push notifications...');
          // Try multiple times with increasing delays to ensure service worker is ready
          const trySetupPush = async (attempt = 1) => {
            console.log(`📱 Push setup attempt ${attempt}/3`);
            try {
              await setupPushNotifications();
              console.log('✅ Push notifications setup completed successfully');
            } catch (error) {
              console.log(`❌ Push setup attempt ${attempt} failed:`, error);
              if (attempt < 3) {
                console.log(`⏳ Retrying push setup in ${attempt * 2} seconds...`);
                setTimeout(() => trySetupPush(attempt + 1), attempt * 2000);
              } else {
                console.log('❌ All push setup attempts failed');
              }
            }
          };
          
          // Start first attempt after a short delay
          setTimeout(() => trySetupPush(), 1000);
        } else {
          console.log('❌ Notification permission denied or not granted');
          if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
            console.log('📱 iOS detected - notifications require PWA to be added to home screen first');
          }
        }
      }
    };

    // Handle visibility changes for better PWA behavior
    const handleVisibilityChange = () => {
      console.log('📱 Visibility changed:', document.hidden, document.visibilityState);
      if (document.visibilityState === 'visible') {
        console.log('👀 App foregrounded - notifying server');
        // Tell server we're in foreground (visible)
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'app-visibility',
            visible: true
          }));
        }
      } else {
        console.log('🏠 App backgrounded - notifying server for push notifications');
        // Tell server we're in background (hidden) for push notifications
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'app-visibility',
            visible: false
          }));
        }
      }
    };

    requestNotificationPermission();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket]); // Remove notificationsEnabled dependency to prevent loops

  // Separate effect for auto-setting up push notifications - only runs once
  useEffect(() => {
    // Check notification permission and sync state
    if ('Notification' in window) {
      const currentPermission = Notification.permission;
      console.log('🔔 Current notification permission:', currentPermission);
      console.log('🔔 Current enabled state:', notificationsEnabled);
      
      if (notificationsEnabled && currentPermission === 'granted') {
        console.log('🔔 Auto-setting up push notifications (already enabled)');
        const timeoutId = setTimeout(() => {
          setupPushNotifications().catch(error => {
            console.error('Failed to auto-setup push notifications:', error);
          });
        }, 2000);
        return () => clearTimeout(timeoutId);
      } else if (notificationsEnabled && currentPermission !== 'granted') {
        console.log('🔔 Notifications were enabled but permission revoked, disabling');
        setNotificationsEnabled(false);
        localStorage.setItem('notificationsEnabled', 'false');
      }
    }
  }, []); // Empty dependency array - only run once on mount

  // Function to play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.log('Sound notification error:', error);
    }
  };

  // Function to show browser notification (enhanced for PWA)
  const showNotification = (title: string, message: string, icon?: string) => {
    console.log('showNotification called:', { title, message, notificationsEnabled, hasFocus: document.hasFocus(), isStandalone: window.matchMedia('(display-mode: standalone)').matches });
    
    if (!notificationsEnabled) {
      console.log('Notifications disabled, skipping');
      return;
    }

    // For PWA (standalone mode), always show notifications
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const shouldShowNotification = isStandalone || !document.hasFocus() || document.hidden;
    
    // Always play sound for background notifications
    if (!document.hasFocus() || document.hidden) {
      playNotificationSound();
    }
    
    if (!shouldShowNotification) {
      console.log('Tab is focused and not in standalone mode, skipping notification');
      return;
    }

    try {
      // Try to use service worker for better PWA support
      if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
        console.log('Attempting to show service worker notification');
        navigator.serviceWorker.ready.then(registration => {
          console.log('Service worker ready, showing notification');
          const notificationOptions: any = {
            body: message,
            icon: icon || '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'blabb-message',
            requireInteraction: false,
            silent: !soundEnabled,
            data: {
              url: window.location.href,
              timestamp: Date.now(),
              roomId: window.location.pathname.split('/').pop()
            },
            actions: [
              {
                action: 'open',
                title: 'Open Chat'
              }
            ]
          };
          
          // Add vibration for mobile devices
          if (soundEnabled && 'vibrate' in navigator) {
            notificationOptions.vibrate = [100, 50, 100];
          }
          
          return registration.showNotification(title, notificationOptions);
        }).then(() => {
          console.log('Service worker notification shown successfully');
        }).catch((error) => {
          console.log('Service worker notification failed:', error);
          // Fallback to regular notification
          showRegularNotification(title, message, icon);
        });
      } else {
        console.log('Service worker not available, using regular notification');
        showRegularNotification(title, message, icon);
      }
    } catch (error) {
      console.log('Notification error:', error);
      showRegularNotification(title, message, icon);
    }
  };

  // Fallback regular notification function
  const showRegularNotification = (title: string, message: string, icon?: string) => {
    try {
      const notification = new Notification(title, {
        body: message,
        icon: icon || '/icon-192.png',
        tag: 'blabb-message',
        requireInteraction: false,
        silent: !soundEnabled,
      });

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Focus window when notification is clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.log('Regular notification error:', error);
    }
  };

  // Toggle notification permission
  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      toast({
        title: "Notifications not supported",
        description: "Your browser doesn't support notifications",
        variant: "destructive",
      });
      return;
    }

    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('notificationsEnabled', 'false');
      toast({
        title: "Notifications disabled",
        description: "You won't receive message alerts",
      });
    } else {
      console.log('🔔 Starting notification permission request...');
      const permission = await Notification.requestPermission();
      console.log('🔔 Permission result:', permission);
      
      if (permission === 'granted') {
        console.log('🔔 Permission granted, starting push setup...');
        toast({
          title: "Notifications enabled",
          description: "Setting up push notifications...",
        });
        
        try {
          // Setup push notifications first, only enable if successful
          await setupPushNotifications();
          
          // Only set enabled state if push setup succeeded
          setNotificationsEnabled(true);
          localStorage.setItem('notificationsEnabled', 'true');
          console.log('✅ Push setup completed successfully');
          
          toast({
            title: "Push Notifications Ready",
            description: "You'll get alerts when the app is in the background",
            className: "bg-green-50 border-green-200 text-green-800",
          });
          
        } catch (error) {
          console.error('❌ Push setup failed:', error);
          
          // Reset notification state on failure
          setNotificationsEnabled(false);
          localStorage.setItem('notificationsEnabled', 'false');
          
          toast({
            title: "Push Setup Failed",
            description: `iOS Push Error: ${error.message}`,
            variant: "destructive",
          });
        }
      } else {
        console.log('❌ Notification permission denied');
        toast({
          title: "Notifications blocked",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Chat interface received message:', data.type, data);

        // Handle server heartbeat here since useSocket no longer handles them
        if (data.type === 'server-heartbeat') {
          try {
            // Send back a response to confirm connection is alive
            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'heartbeat-ack' }));
            }
          } catch (heartbeatError) {
            console.error('Error sending heartbeat:', heartbeatError);
          }
          return; // Don't process heartbeat further
        }

        switch (data.type) {
          case 'room-joined':
          case 'session-restored':
            try {
              console.log('Room data received:', data.type, data);
              setRoom(data.room || null);
              setMessages(data.messages || []);
              setParticipants(data.participants || []);
            } catch (roomError) {
              console.error('Error handling room data:', roomError);
            }
            break;
          case 'new-message':
            try {
              if (data.message) {
                setMessages(prev => [...prev, data.message]);
                
                // Show notification for new messages from other users
                if (data.message.nickname !== nickname) {
                  const messagePreview = data.message.content.length > 50 
                    ? data.message.content.substring(0, 50) + '...'
                    : data.message.content;
                  
                  // Always play sound for new messages (when tab isn't focused)
                  if (!document.hasFocus()) {
                    playNotificationSound();
                  }
                  
                  // Show browser notification if enabled
                  console.log('Triggering notification for new message from:', data.message.nickname);
                  showNotification(
                    `${data.message.nickname} in ${room?.name || 'Chat Room'}`,
                    messagePreview
                  );
                }
              }
            } catch (messageError) {
              console.error('Error adding new message:', messageError);
            }
            break;
          case 'user-joined':
            try {
              toast({
                title: "User joined",
                description: `${data.nickname || 'Someone'} joined the chat`,
              });
              if (data.participant) {
                setParticipants(prev => [...prev, data.participant]);
              }
            } catch (joinError) {
              console.error('Error handling user join:', joinError);
            }
            break;
          case 'user-left':
            try {
              const leftMessage = data.reason === 'kicked' 
                ? `${data.nickname || 'User'} was removed from the room`
                : `${data.nickname || 'User'} left the chat`;
              toast({
                title: data.reason === 'kicked' ? "User kicked" : "User left",
                description: leftMessage,
              });
              if (data.nickname) {
                setParticipants(prev => prev.filter(p => p.nickname !== data.nickname));
              }
            } catch (leftError) {
              console.error('Error handling user leave:', leftError);
            }
            break;
          case 'kicked':
            try {
              // User was kicked from the room
              toast({
                title: "Removed from room",
                description: data.message || "You have been removed from the room",
                variant: "destructive",
              });
              // Navigate back to home page after showing the message
              setTimeout(() => {
                onLeaveRoom();
              }, 2000);
            } catch (kickError) {
              console.error('Error handling kick:', kickError);
              // Ensure we still leave the room even if toast fails
              onLeaveRoom();
            }
            break;
          case 'warning':
            try {
              setWarning(data.message || "");
              setTimeout(() => setWarning(""), 5000);
            } catch (warningError) {
              console.error('Error handling warning:', warningError);
            }
            break;
          case 'user-banned':
            try {
              // Show ban notification to room
              toast({
                title: "User banned",
                description: `${data.nickname || 'User'} has been temporarily banned (${data.duration || '10 minutes'}) - ${data.reason || 'Content violation'}`,
                variant: "destructive",
              });
              if (data.nickname) {
                setParticipants(prev => prev.filter(p => p.nickname !== data.nickname));
              }
            } catch (banError) {
              console.error('Error handling user ban notification:', banError);
            }
            break;
          case 'error':
            try {
              toast({
                title: "Error",
                description: data.message || "An error occurred",
                variant: "destructive",
              });
              if (data.message === "Room not found") {
                onLeaveRoom();
              }
            } catch (errorError) {
              console.error('Error handling error message:', errorError);
            }
            break;
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        // Don't crash the UI on WebSocket errors
        toast({
          title: "Connection issue",
          description: "There was a problem with the real-time connection.",
          variant: "destructive",
        });
      }
    };

    socket.addEventListener('message', handleMessage);
    
    // Handle unexpected connection close - just log, don't show disruptive toasts
    const handleClose = () => {
      console.log('WebSocket connection closed - will reconnect automatically');
      // Don't show toast - PWA reconnection is normal behavior
    };
    
    const handleError = (event: Event) => {
      console.log('WebSocket error occurred:', event);
      // Don't show error toasts - they interfere with push notifications
      // Users will notice if messages don't send/receive
    };
    
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleError);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('close', handleClose);
      socket.removeEventListener('error', handleError);
    };
  }, [socket, toast, onLeaveRoom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Setup notifications when joining a room
  useEffect(() => {
    if (!roomId || !notificationsEnabled) return;
    
    console.log('🔔 Room joined, setting up push notifications for room:', roomId);
    
    const setupForRoom = async () => {
      // Always try to setup push notifications when joining a room if notifications are enabled
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          console.log('✅ Permission granted, setting up push for room:', roomId);
          await setupPushNotifications();
          console.log('✅ Push notifications ready for room:', roomId);
        } else if ('Notification' in window && Notification.permission === 'default') {
          console.log('🔔 Requesting permission for room:', roomId);
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            console.log('✅ Permission granted, setting up push for room:', roomId);
            await setupPushNotifications();
            localStorage.setItem('notificationsEnabled', 'true');
          } else {
            console.log('❌ Permission denied');
            setNotificationsEnabled(false);
            localStorage.setItem('notificationsEnabled', 'false');
          }
        }
      } catch (error) {
        console.error('❌ Failed to setup push for room:', error);
      }
    };
    
    setupForRoom();
  }, [roomId, notificationsEnabled]);

  // Sync notification state with browser permission on load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const syncNotificationState = () => {
      if ('Notification' in window && Notification.permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('notificationsEnabled', 'true');
      } else if (Notification.permission === 'denied') {
        setNotificationsEnabled(false);
        localStorage.setItem('notificationsEnabled', 'false');
      }
    };
    
    syncNotificationState();
  }, []);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !socket) return;

    socket.send(JSON.stringify({
      type: 'send-message',
      content: messageInput.trim(),
    }));

    setMessageInput("");
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Chat Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <MessageCircle className="text-white h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Room: {room.name || roomId}</h2>
            <p className="text-sm text-gray-500">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
              {room.maxParticipants && ` / ${room.maxParticipants}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleNotifications}
            className={`${
              notificationsEnabled 
                ? 'text-primary hover:text-primary/80' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
          >
            {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`${
              soundEnabled 
                ? 'text-primary hover:text-primary/80' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={soundEnabled ? 'Disable sound' : 'Enable sound'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQRModal(true)}
            className="text-gray-500 hover:text-gray-700"
            title="Share room"
          >
            <Share className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeaveRoom}
            className="text-gray-500 hover:text-gray-700"
            title="Leave room"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.nickname === nickname;
          const isSystemMessage = message.nickname === 'system';

          if (isSystemMessage) {
            return (
              <div key={message.id} className="text-center">
                <div className="inline-block bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full text-sm message-system">
                  {message.content}
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex items-start space-x-3 ${
                isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isOwnMessage ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`text-sm font-medium ${
                    isOwnMessage ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {getInitial(message.nickname)}
                </span>
              </div>
              <div className={`flex-1 ${isOwnMessage ? 'flex flex-col items-end' : ''}`}>
                <div
                  className={`flex items-center space-x-2 mb-1 ${
                    isOwnMessage ? 'justify-end' : ''
                  }`}
                >
                  <span className="text-sm font-medium text-gray-900">
                    {isOwnMessage ? 'You' : message.nickname}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div
                  className={`px-3 py-2 rounded-lg max-w-xs inline-block text-left ${
                    isOwnMessage
                      ? 'bg-primary text-white message-own'
                      : 'bg-gray-100 text-gray-900 message-other'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Warning message */}
      {warning && (
        <div className="px-4 py-2 bg-yellow-50 border-t border-yellow-200">
          <p className="text-sm text-yellow-800">{warning}</p>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <Input
            type="text"
            placeholder="Type your message..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="flex-1"
            maxLength={500}
          />
          <Button type="submit" className="bg-primary hover:bg-primary/90">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* QR Modal */}
      <QRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        room={room}
      />
    </div>
  );
}
