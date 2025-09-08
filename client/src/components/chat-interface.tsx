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

  // Simple push notification setup - always enabled
  const setupPushNotifications = async () => {
    if (isSettingUpPush) return;
    
    setIsSettingUpPush(true);
    try {
      if (!('serviceWorker' in navigator)) {
        console.log('❌ Service worker not supported');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      if (!('PushManager' in window)) {
        console.log('❌ Push notifications not supported');
        return;
      }

      // Get VAPID public key
      const vapidResponse = await fetch('/api/vapid-public-key');
      const { publicKey } = await vapidResponse.json();
      
      // Convert VAPID key properly
      const convertedKey = urlBase64ToUint8Array(publicKey);
      
      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });

      // Get current session ID
      const sessionResponse = await fetch('/api/session/current');
      const sessionData = await sessionResponse.json();
      
      if (!sessionData.sessionId) {
        console.log('❌ No session ID available for push registration');
        return;
      }

      // Send subscription to server with sessionId
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          subscription: subscription.toJSON()
        })
      });

      console.log('✅ Push notifications set up successfully');
    } catch (error) {
      console.log('❌ Push notification setup failed:', error);
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

  // Request notification permission on mount
  useEffect(() => {
    const requestPermissions = async () => {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await setupPushNotifications();
        }
      }
    };
    
    requestPermissions();
  }, []);

  // Setup WebSocket message handling
  useEffect(() => {
    if (!socket) return;

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