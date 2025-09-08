import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface Message {
  id: number;
  nickname: string;
  content: string;
  timestamp: string;
  isFiltered: boolean;
}

interface Participant {
  nickname: string;
  socketId: string;
}

interface Room {
  id: string;
  name: string;
  createdBy: string;
  maxParticipants: number;
  expiresAt?: string;
  createdAt: string;
  isActive: boolean;
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
  
  // Sound toggle - simplified (no notification toggle)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('soundEnabled');
    return saved !== 'false'; // Default to true
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isSettingUpPush, setIsSettingUpPush] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Mobile-compatible push notification setup with detailed logging
  const setupPushNotifications = async () => {
    if (isSettingUpPush) return;
    
    setIsSettingUpPush(true);
    try {
      console.log('🚀 Starting push notification setup...');
      
      // Step 1: Check service worker support
      if (!('serviceWorker' in navigator)) {
        console.log('❌ Service worker not supported');
        return;
      }
      console.log('✅ Service worker supported');

      // Step 2: Wait for service worker
      console.log('⏳ Waiting for service worker ready...');
      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service worker ready:', !!registration);
      
      // Step 3: Check push manager
      if (!('PushManager' in window)) {
        console.log('❌ Push notifications not supported');
        return;
      }
      console.log('✅ PushManager supported');

      // Step 4: Get VAPID key
      console.log('⏳ Fetching VAPID key...');
      const vapidResponse = await fetch('/api/vapid-public-key');
      if (!vapidResponse.ok) {
        throw new Error(`VAPID fetch failed: ${vapidResponse.status}`);
      }
      const { publicKey } = await vapidResponse.json();
      console.log('✅ VAPID key received:', publicKey.substring(0, 20) + '...');
      
      // Step 5: Convert VAPID key
      console.log('⏳ Converting VAPID key...');
      const convertedKey = urlBase64ToUint8Array(publicKey);
      console.log('✅ VAPID key converted, length:', convertedKey.length);
      
      // Step 6: Subscribe to push
      console.log('⏳ Subscribing to push notifications...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
      console.log('✅ Push subscription created:', !!subscription);
      console.log('📱 Endpoint:', subscription.endpoint.substring(0, 50) + '...');

      // Step 7: Get session ID
      console.log('⏳ Getting session ID...');
      const sessionResponse = await fetch('/api/session/current');
      if (!sessionResponse.ok) {
        throw new Error(`Session fetch failed: ${sessionResponse.status}`);
      }
      const sessionData = await sessionResponse.json();
      console.log('✅ Session ID received:', sessionData.sessionId?.substring(0, 20) + '...');
      
      if (!sessionData.sessionId) {
        throw new Error('No session ID in response');
      }

      // Step 8: Send to server
      console.log('⏳ Sending subscription to server...');
      const subscribeResponse = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          subscription: subscription.toJSON()
        })
      });
      
      if (!subscribeResponse.ok) {
        throw new Error(`Subscribe failed: ${subscribeResponse.status}`);
      }
      
      const result = await subscribeResponse.json();
      console.log('✅ Server response:', result);
      console.log('🎉 Push notifications set up successfully!');
    } catch (error) {
      console.error('💥 Push notification setup failed at step:', error instanceof Error ? error.message : 'Unknown error');
      console.error('💥 Full error:', error);
    } finally {
      setIsSettingUpPush(false);
    }
  };

  // Helper function to convert VAPID key for mobile compatibility
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

  // Simple notification sound function
  const playNotificationSound = () => {
    console.log('🔊 playNotificationSound called - soundEnabled:', soundEnabled);
    if (!soundEnabled) {
      console.log('🔇 Sound is disabled, skipping');
      return;
    }
    console.log('🔊 Playing notification sound...');
    
    try {
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

  // Simple notification display function
  const showNotification = (title: string, message: string, icon?: string) => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const shouldShowNotification = isStandalone || !document.hasFocus() || document.hidden;
    
    if (!shouldShowNotification) {
      return;
    }

    try {
      if ('serviceWorker' in navigator && 'showNotification' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
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
              roomId: roomId
            }
          };
          
          return registration.showNotification(title, notificationOptions);
        });
      } else {
        // Fallback to regular notification
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body: message,
            icon: icon || '/icon-192.png',
            silent: !soundEnabled
          });
        }
      }
    } catch (error) {
      console.log('Notification error:', error);
    }
  };

  // Force service worker update and request notification permission
  useEffect(() => {
    const forceServiceWorkerUpdate = async () => {
      if ('serviceWorker' in navigator) {
        try {
          console.log('🔄 Force updating service worker...');
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.update();
            console.log('✅ Service worker updated');
          }
        } catch (error) {
          console.log('❌ Service worker update failed:', error);
        }
      }
    };
    
    const requestPermissions = async () => {
      try {
        // Force service worker update first
        await forceServiceWorkerUpdate();
        
        console.log('🔔 Starting notification permission request...');
        if (!('Notification' in window)) {
          console.log('❌ Notifications not supported');
          return;
        }
        
        console.log('🔔 Current permission:', Notification.permission);
        const permission = await Notification.requestPermission();
        console.log('🔔 Permission result:', permission);
        
        if (permission === 'granted') {
          console.log('✅ Permission granted, setting up push notifications...');
          await setupPushNotifications();
          
          // Retry after 2 seconds if first attempt failed (mobile browsers can be flaky)
          setTimeout(async () => {
            console.log('🔄 Retrying push notification setup...');
            try {
              await setupPushNotifications();
            } catch (retryError) {
              console.error('❌ Retry also failed:', retryError);
            }
          }, 2000);
        } else {
          console.log('❌ Permission denied or dismissed');
        }
      } catch (error) {
        console.error('❌ Permission request failed:', error);
      }
    };
    
    requestPermissions();
  }, []);

  // Push registration ONLY when actively joining a room via WebSocket
  useEffect(() => {
    if (!socket || !roomId || !room) return; // Only register when we have active room data
    
    // Register push notifications for this specific room
    const registerForRoom = async () => {
      if (Notification.permission === 'granted') {
        console.log('🏠 Registering push notifications for ACTIVE room:', roomId);
        
        // First unregister from any previous rooms
        try {
          await fetch('/api/push-unsubscribe', { method: 'POST' });
          console.log('🔕 Unregistered from previous room');
        } catch (error) {
          console.log('🔕 No previous subscription to unregister');
        }
        
        try {
          await setupPushNotifications();
          
          // Verify registration with a test push after 2 seconds
          setTimeout(async () => {
            try {
              console.log('🧪 Testing push notification registration...');
              const response = await fetch(`/api/test-push-registration/${roomId}`, {
                method: 'POST'
              });
              if (response.ok) {
                console.log('✅ Push registration test successful');
              } else {
                console.log('❌ Push registration test failed, retrying...');
                await setupPushNotifications();
              }
            } catch (error) {
              console.error('❌ Push registration test error:', error);
            }
          }, 2000);
        } catch (error) {
          console.error('❌ Room push registration failed:', error);
        }
      }
    };
    
    setTimeout(registerForRoom, 1000); // Register after socket is stable
  }, [socket, roomId, room]);

  // App resume/background detection for push re-registration
  useEffect(() => {
    let wasHidden = false;
    
    const handleAppResume = async () => {
      const isVisible = !document.hidden;
      
      if (wasHidden && isVisible) {
        // App is resuming from background
        console.log('📱 App resuming from background - re-registering push notifications');
        
        if (Notification.permission === 'granted' && roomId && socket) {
          try {
            await setupPushNotifications();
            console.log('✅ Push notifications re-registered on app resume');
            
            // Test the registration
            setTimeout(async () => {
              try {
                const response = await fetch(`/api/test-push-registration/${roomId}`, {
                  method: 'POST'
                });
                if (response.ok) {
                  console.log('✅ App resume push test successful');
                } else {
                  console.log('❌ App resume push test failed');
                }
              } catch (error) {
                console.error('❌ App resume push test error:', error);
              }
            }, 1000);
          } catch (error) {
            console.error('❌ Push re-registration on resume failed:', error);
          }
        }
      }
      
      wasHidden = !isVisible;
    };
    
    document.addEventListener('visibilitychange', handleAppResume);
    
    // Also listen for focus/blur events for better mobile detection
    const handleFocus = () => handleAppResume();
    const handleBlur = () => { wasHidden = true; };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleAppResume);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [roomId, socket]);

  // WebSocket connection and visibility tracking
  useEffect(() => {
    if (!socket) return;

    // Send current visibility state when socket connects
    const sendVisibilityState = () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        const isVisible = !document.hidden && document.hasFocus();
        console.log(`📱 Sending visibility state: ${isVisible ? 'visible' : 'hidden'}`);
        socket.send(JSON.stringify({
          type: 'app-visibility',
          visible: isVisible
        }));
      }
    };

    // Send initial visibility state
    setTimeout(sendVisibilityState, 100);

    // Track visibility changes
    const handleVisibilityChange = () => {
      sendVisibilityState();
    };

    const handleFocusChange = () => {
      sendVisibilityState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocusChange);
    window.addEventListener('blur', handleFocusChange);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Chat interface received message:', data.type, data);

        // Handle server heartbeat
        if (data.type === 'server-heartbeat') {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'heartbeat-ack' }));
          }
          return;
        }

        switch (data.type) {
          case 'room-joined':
          case 'session-restored':
            setRoom(data.room || null);
            setMessages(data.messages || []);
            setParticipants(data.participants || []);
            break;
            
          case 'new-message':
            if (data.message) {
              setMessages(prev => [...prev, data.message]);
              
              // Show notification for new messages from other users
              if (data.message.nickname !== nickname) {
                const messagePreview = data.message.content.length > 50 
                  ? data.message.content.substring(0, 50) + '...'
                  : data.message.content;
                
                // Always play sound for new messages (regardless of tab focus)
                playNotificationSound();
                
                // Show browser notification
                showNotification(
                  `${data.message.nickname} in ${room?.name || 'Chat Room'}`,
                  messagePreview
                );
              }
            }
            break;
            
          case 'user-joined':
            toast({
              title: "User joined",
              description: `${data.nickname || 'Someone'} joined the chat`,
            });
            if (data.participant) {
              setParticipants(prev => [...prev, data.participant]);
            }
            break;
            
          case 'user-left':
            const leftMessage = data.reason === 'kicked' 
              ? `${data.nickname || 'User'} was removed from the room`
              : `${data.nickname || 'User'} left the chat`;
              
            toast({
              title: data.reason === 'kicked' ? "User removed" : "User left",
              description: leftMessage,
            });
            
            setParticipants(prev => prev.filter(p => p.nickname !== data.nickname));
            break;
            
          case 'warning':
            setWarning(data.message || 'You have received a warning for inappropriate content.');
            setTimeout(() => setWarning(''), 5000);
            break;
            
          case 'kicked':
            toast({
              title: "Removed from room",
              description: data.message || 'You have been removed from this room.',
              variant: "destructive",
            });
            setTimeout(() => onLeaveRoom(), 2000);
            break;
            
          case 'participants-update':
            setParticipants(data.participants || []);
            break;
            
          case 'error':
            // Handle server errors (like room not found)
            toast({
              title: "Room Error",
              description: data.message || 'An error occurred',
              variant: "destructive",
            });
            
            // If room not found, redirect to home page after showing error
            if (data.message && data.message.includes('Room not found')) {
              console.log('Room not found - redirecting to home page');
              setTimeout(() => {
                window.location.href = '/';
              }, 2000);
            }
            break;
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };

    socket.addEventListener('message', handleMessage);
    
    const handleClose = () => {
      console.log('WebSocket connection closed - will reconnect automatically');
    };
    
    const handleError = (event: Event) => {
      console.log('WebSocket error occurred:', event);
    };
    
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleError);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('close', handleClose);
      socket.removeEventListener('error', handleError);
      
      // Clean up visibility tracking
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocusChange);
      window.removeEventListener('blur', handleFocusChange);
    };
  }, [socket, nickname, room, toast, onLeaveRoom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (!messageInput.trim() || !socket) return;

    socket.send(JSON.stringify({
      type: 'send-message',
      content: messageInput.trim()
    }));

    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  const generateQRCode = async () => {
    try {
      const url = `${window.location.origin}/room/${roomId}`;
      const qrCodeDataURL = await QRCode.toDataURL(url, {
        width: 256,
        margin: 1,
      });
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };

  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    if (showQRModal && !qrCode) {
      generateQRCode().then(setQrCode);
    }
  }, [showQRModal, qrCode]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {room?.name || 'Chat Room'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newSoundEnabled = !soundEnabled;
                setSoundEnabled(newSoundEnabled);
                localStorage.setItem('soundEnabled', newSoundEnabled.toString());
                console.log('🔊 Sound toggled:', newSoundEnabled ? 'enabled' : 'disabled');
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                soundEnabled 
                  ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200' 
                  : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
              }`}
            >
              {soundEnabled ? '🔊 ON' : '🔇 OFF'}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQRModal(true)}
              className="text-xs"
            >
              📱 Share
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onLeaveRoom}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Leave Room
            </Button>
          </div>
        </div>
        
        {/* Warning message */}
        {warning && (
          <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-yellow-800 text-sm">
            ⚠️ {warning}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.nickname === nickname ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                message.nickname === nickname
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {message.nickname !== nickname && (
                <div className="text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                  {message.nickname}
                </div>
              )}
              <div className={`text-sm ${message.isFiltered ? 'italic text-gray-500' : ''}`}>
                {message.content}
              </div>
              <div className={`text-xs mt-1 opacity-70 ${
                message.nickname === nickname ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-2">
          <Input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            maxLength={500}
          />
          <Button onClick={sendMessage} disabled={!messageInput.trim()}>
            Send
          </Button>
        </div>
      </div>

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-center">Share Room</h3>
            {qrCode && (
              <div className="flex flex-col items-center space-y-4">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Scan this QR code to join the room
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 text-center break-all">
                  {`${window.location.origin}/room/${roomId}`}
                </p>
              </div>
            )}
            <Button
              onClick={() => {
                setShowQRModal(false);
                setQrCode(null);
              }}
              className="w-full mt-4"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}