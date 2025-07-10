import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Plus, Users, Zap, Shield, Share } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import logoPath from "@assets/logo1_1752172738003.png";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [nickname, setNickname] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const { toast } = useToast();

  const createNewRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const response = await apiRequest("POST", "/api/rooms", {
        name: "Quick Chat Room",
        maxParticipants: 10,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        createdBy: "anonymous",
      });

      if (response.ok) {
        const room = await response.json();
        setLocation(`/room/${room.id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinExistingRoom = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roomInput.trim() || !nickname.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both room code and nickname",
        variant: "destructive",
      });
      return;
    }

    // Extract room ID from URL or use as is
    let roomId = roomInput.trim();
    if (roomId.includes('/room/')) {
      roomId = roomId.split('/room/')[1];
    }

    setLocation(`/room/${roomId}?nickname=${encodeURIComponent(nickname)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <MessageCircle className="text-white h-6 w-6" />
              </div>
              <div className="text-2xl font-bold">
                <span className="text-secondary">blabb</span>
                <span className="text-accent">.me</span>
              </div>
            </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#home" className="text-gray-600 hover:text-secondary transition-colors">
                Home
              </a>
              <a href="#about" className="text-gray-600 hover:text-secondary transition-colors">
                About
              </a>
              <Button
                variant="ghost"
                onClick={() => setLocation("/admin-login")}
                className="text-gray-600 hover:text-secondary"
              >
                Admin
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Start Chatting
              <span className="text-primary"> Instantly</span>
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Create or join anonymous chat rooms in seconds. No signup required.
              Share with friends using QR codes or simple links.
            </p>

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                size="lg"
                onClick={createNewRoom}
                disabled={isCreatingRoom}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                <Plus className="mr-2 h-5 w-5" />
                {isCreatingRoom ? "Creating Room..." : "Start New Chat"}
              </Button>
              <Button
                size="lg"
                onClick={() => setShowJoinModal(true)}
                className="w-full sm:w-auto bg-secondary hover:bg-secondary/90 text-white px-8 py-4 text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                <Users className="mr-2 h-5 w-5" />
                Join Existing Chat
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <Card className="border-gray-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Zap className="text-primary h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Access</h3>
                  <p className="text-gray-600">
                    No registration needed. Just pick a nickname and start chatting immediately.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-gray-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Shield className="text-secondary h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Anonymous & Safe</h3>
                  <p className="text-gray-600">
                    Your privacy matters. Chat anonymously with built-in content moderation.
                  </p>
                </CardContent>
              </Card>
              <Card className="border-gray-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Share className="text-accent h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Sharing</h3>
                  <p className="text-gray-600">
                    Share rooms with QR codes or simple links. Perfect for events and groups.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Join Chat Modal */}
      <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Join Chat Room</DialogTitle>
          </DialogHeader>
          <form onSubmit={joinExistingRoom} className="space-y-4">
            <div>
              <Label htmlFor="room-input">Room Code or URL</Label>
              <Input
                id="room-input"
                type="text"
                placeholder="Enter room code or paste URL"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="nickname-input">Your Nickname</Label>
              <Input
                id="nickname-input"
                type="text"
                placeholder="Enter your nickname"
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" className="w-full bg-secondary hover:bg-secondary/90">
              Join Chat
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
