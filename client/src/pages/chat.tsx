import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useSocket } from "@/hooks/use-socket";
import ChatInterface from "@/components/chat-interface";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

  if (showNicknameModal) {
    return (
      <Dialog open={showNicknameModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Your Nickname</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNicknameSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nickname">Choose a nickname</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="Your nickname"
                maxLength={20}
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex space-x-2">
              <Button type="submit" className="flex-1">
                Join Room
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
