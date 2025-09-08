import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";
import { useSession } from "@/hooks/use-session";
import ChatInterface from "@/components/chat-interface";
import { MessageCircle } from "lucide-react";

interface ChatPageProps {
  params: {
    roomId: string;
  };
}

export default function Chat({ params }: ChatPageProps) {
  const { roomId } = params;
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState("");
  const [tempNickname, setTempNickname] = useState("");
  const [showNicknameModal, setShowNicknameModal] = useState(true);
  const [sessionRestored, setSessionRestored] = useState(false);
  
  console.log("Chat page loaded with roomId:", roomId);
  
  const { sessionId, session, updateSession, isLoading } = useSession();
  
  const handleSessionRestore = (data: any) => {
    console.log('Session restore data received:', data);
    if (data.room && data.room.id === roomId && data.nickname) {
      console.log('Session restored for room:', data.room.id, 'nickname:', data.nickname);
      setNickname(data.nickname);
      setShowNicknameModal(false);
      setSessionRestored(true);
      // Update session to ensure consistency
      updateSession(roomId, data.nickname);
    }
  };
  
  // Check if we should show nickname modal based on session state
  useEffect(() => {
    if (!isLoading && session && session.roomId === roomId && session.nickname) {
      // User has an existing session for this room, skip nickname modal
      setNickname(session.nickname);
      setShowNicknameModal(false);
      console.log('Found existing session for room:', roomId, 'nickname:', session.nickname);
    }
  }, [session, roomId, isLoading]);
  
  const { socket } = useSocket({ 
    sessionId, 
    onSessionRestore: handleSessionRestore 
  });

  useEffect(() => {
    // Check if nickname is provided in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const urlNickname = urlParams.get('nickname');
    if (urlNickname) {
      setNickname(urlNickname);
      setShowNicknameModal(false);
    }
  }, []);

  useEffect(() => {
    // Only join room if we have all required data and haven't been restored from session
    if (socket && nickname && roomId && !sessionRestored && sessionId) {
      console.log('Sending join-room message:', { roomId, nickname, sessionId });
      socket.send(JSON.stringify({
        type: 'join-room',
        roomId,
        nickname,
        sessionId,
      }));
      
      // Update session with room info
      updateSession(roomId, nickname);
    }
  }, [socket, nickname, roomId, sessionId, sessionRestored]);

  // Reset sessionRestored when changing rooms
  useEffect(() => {
    setSessionRestored(false);
  }, [roomId]);

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempNickname.trim()) {
      setNickname(tempNickname.trim());
      setShowNicknameModal(false);
    }
  };

  const handleLeaveRoom = async () => {
    // First, unsubscribe from push notifications for this room
    try {
      await fetch('/api/push-unsubscribe', { method: 'POST' });
      console.log('🔕 Unsubscribed from push notifications on room leave');
    } catch (error) {
      console.error('❌ Failed to unsubscribe from push notifications:', error);
    }
    
    if (socket) {
      // Send explicit leave message
      socket.send(JSON.stringify({ 
        type: 'leave-room',
        explicit: true  // Mark as explicit user action
      }));
    }
    // Clear session room info when explicitly leaving
    updateSession();
    setLocation("/");
  };

  console.log("showNicknameModal:", showNicknameModal, "socket:", !!socket, "nickname:", nickname, "isLoading:", isLoading);

  // Show loading while session is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (showNicknameModal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="text-white h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Room</h2>
            <p className="text-gray-600">Room ID: {roomId}</p>
          </div>
          
          <form onSubmit={handleNicknameSubmit} className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium mb-2 text-gray-700">Choose your nickname</label>
              <input
                id="nickname"
                type="text"
                placeholder="Enter your nickname"
                maxLength={20}
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                autoFocus
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex space-x-3">
              <button type="submit" className="flex-1 bg-primary text-white py-3 px-4 rounded-md hover:bg-primary/90 font-medium">
                Join Chat
              </button>
              <button
                type="button"
                onClick={() => setLocation("/")}
                className="py-3 px-4 border border-gray-300 rounded-md hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <ChatInterface
      roomId={roomId}
      nickname={nickname}
      socket={socket}
      onLeaveRoom={handleLeaveRoom}
      updateSession={updateSession}
    />
  );
}
