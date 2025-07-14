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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Request notification permission when component mounts
  useEffect(() => {
    const requestNotificationPermission = async () => {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setNotificationsEnabled(permission === 'granted');
      }
    };

    requestNotificationPermission();
  }, []);

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

  // Function to show browser notification
  const showNotification = (title: string, message: string, icon?: string) => {
    if (!notificationsEnabled || document.hasFocus()) {
      // Still play sound even if tab is active (if sound is enabled)
      if (!document.hasFocus()) {
        playNotificationSound();
      }
      return; // Don't show notification if tab is active or permissions not granted
    }

    try {
      const notification = new Notification(title, {
        body: message,
        icon: icon || '/favicon.ico',
        tag: 'blabb-message', // This replaces previous notifications
        requireInteraction: false,
        silent: !soundEnabled, // Use system sound if enabled
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
      console.log('Notification error:', error);
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
      toast({
        title: "Notifications disabled",
        description: "You won't receive message alerts",
      });
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        toast({
          title: "Notifications enabled",
          description: "You'll receive alerts for new messages",
        });
      } else {
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
    
    // Handle unexpected connection close
    const handleClose = () => {
      console.log('WebSocket connection closed unexpectedly');
      toast({
        title: "Connection lost",
        description: "Reconnecting to chat...",
      });
    };
    
    const handleError = () => {
      console.log('WebSocket error occurred');
      toast({
        title: "Connection error",
        description: "There was a problem with the chat connection.",
        variant: "destructive",
      });
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
