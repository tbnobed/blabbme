import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserX, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RoomDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: {
    id: string;
    name?: string;
  };
}

export default function RoomDetailsModal({ isOpen, onClose, room }: RoomDetailsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: roomDetails, isLoading } = useQuery({
    queryKey: ["/api/rooms", room.id],
    enabled: isOpen && !!room.id,
  });

  const { data: bannedUsers, isLoading: isLoadingBans } = useQuery({
    queryKey: ["/api/rooms", room.id, "bans"],
    enabled: isOpen && !!room.id,
  });

  const kickUserMutation = useMutation({
    mutationFn: async (participant: any) => {
      const response = await fetch(`/api/rooms/${room.id}/participants/${participant.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to kick user: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (_, participant) => {
      toast({
        title: "User kicked",
        description: `${participant.nickname} has been removed from the room`,
      });
      // Refresh room details to update participant list
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove user from room",
        variant: "destructive",
      });
      console.error("Failed to kick user:", error);
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (nickname: string) => {
      const response = await fetch(`/api/rooms/${room.id}/bans/${nickname}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to unban user: ${response.status} ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (_, nickname) => {
      toast({
        title: "User unbanned",
        description: `${nickname} has been unbanned from the room`,
      });
      // Refresh banned users list
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id, "bans"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to unban user",
        variant: "destructive",
      });
      console.error("Failed to unban user:", error);
    },
  });

  const kickUser = (participant: any) => {
    kickUserMutation.mutate(participant);
  };

  const unbanUser = (nickname: string) => {
    unbanUserMutation.mutate(nickname);
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes} minutes ago`;
    }
    return `${diffInHours} hours ago`;
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            Room Details: {roomDetails?.name || room.id}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="participants">
              Participants ({roomDetails?.participants?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="banned">
              Banned Users ({bannedUsers?.length || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="participants">
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {roomDetails?.participants?.map((participant: any) => (
                  <div key={participant.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {getInitial(participant.nickname)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{participant.nickname}</p>
                        <p className="text-xs text-gray-500">
                          Joined {formatRelativeTime(participant.joinedAt)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => kickUser(participant)}
                      disabled={kickUserMutation.isPending}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    No participants in this room
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="banned">
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {bannedUsers?.map((ban: any) => (
                  <div key={ban.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {getInitial(ban.nickname)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{ban.nickname}</p>
                        <p className="text-xs text-gray-500">
                          Banned {formatRelativeTime(ban.bannedAt)} • 
                          Expires {formatRelativeTime(ban.expiresAt)}
                        </p>
                        {ban.reason && (
                          <p className="text-xs text-red-600">
                            Reason: {ban.reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unbanUser(ban.nickname)}
                      disabled={unbanUserMutation.isPending}
                      className="text-green-600 hover:text-green-800 disabled:opacity-50"
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                  </div>
                )) || (
                  <div className="text-center py-8 text-gray-500">
                    No banned users in this room
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Live Chat Feed */}
        <div className="mt-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Live Chat</h4>
          <ScrollArea className="h-48 bg-gray-50 p-3 rounded-lg">
            <div className="space-y-2">
              {roomDetails?.messages?.map((message: any) => (
                <div key={message.id} className="text-sm">
                  <span className="font-medium text-gray-900">{message.nickname}:</span>
                  <span className="text-gray-700 ml-1">{message.content}</span>
                  <span className="text-xs text-gray-500 ml-2">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500">
                  No messages in this room yet
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
