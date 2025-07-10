import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";
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
  
  console.log("Chat page loaded with roomId:", roomId);
  
  const socket = useSocket();

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
    if (socket && nickname && roomId) {
      socket.send(JSON.stringify({
        type: 'join-room',
        roomId,
        nickname,
      }));
    }
  }, [socket, nickname, roomId]);

  const handleNicknameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempNickname.trim()) {
      setNickname(tempNickname.trim());
      setShowNicknameModal(false);
    }
  };

  const handleLeaveRoom = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: 'leave-room' }));
    }
    setLocation("/");
  };

  console.log("showNicknameModal:", showNicknameModal, "socket:", !!socket, "nickname:", nickname);

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
      onLeaveRoom={handleLeaveRoom}
    />
  );
}
