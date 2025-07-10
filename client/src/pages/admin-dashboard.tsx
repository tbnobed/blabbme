import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, MessageCircle, Users, Mail, AlertTriangle, Plus, Eye, QrCode, Trash2, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import QRModal from "@/components/qr-modal";
import RoomDetailsModal from "@/components/room-details-modal";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [newRoom, setNewRoom] = useState({
    name: "",
    maxParticipants: 10,
    expiresAt: "",
  });
  const { toast } = useToast();

  const { data: rooms, isLoading } = useQuery({
    queryKey: ["/api/rooms"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const createRoomMutation = useMutation({
    mutationFn: (roomData: any) => apiRequest("POST", "/api/rooms", roomData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      setShowCreateRoom(false);
      setNewRoom({ name: "", maxParticipants: 10, expiresAt: "" });
      toast({
        title: "Room created",
        description: "New chat room has been created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (roomId: string) => apiRequest("DELETE", `/api/rooms/${roomId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      toast({
        title: "Room deleted",
        description: "Chat room has been deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete room",
        variant: "destructive",
      });
    },
  });

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    
    const roomData = {
      name: newRoom.name,
      maxParticipants: newRoom.maxParticipants,
      expiresAt: newRoom.expiresAt ? new Date(newRoom.expiresAt) : new Date(Date.now() + 30 * 60 * 1000), // Default 30 minutes
      createdBy: "admin",
    };

    createRoomMutation.mutate(roomData);
  };

  const handleViewRoom = (room: any) => {
    setSelectedRoom(room);
    setShowRoomDetails(true);
  };

  const handleGenerateQR = (room: any) => {
    setSelectedRoom(room);
    setShowQRModal(true);
  };

  const handleDeleteRoom = (roomId: string) => {
    if (confirm("Are you sure you want to delete this room?")) {
      deleteRoomMutation.mutate(roomId);
    }
  };

  const handleLogout = () => {
    setLocation("/");
  };

  const stats = {
    activeRooms: rooms?.length || 0,
    onlineUsers: rooms?.reduce((sum: number, room: any) => sum + room.participantCount, 0) || 0,
    messagesTotal: 0, // Would need separate API call
    warnings: 0, // Would need separate API call
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
                <Shield className="text-white h-4 w-4" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">admin</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <MessageCircle className="text-primary h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Active Rooms</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.activeRooms}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                  <Users className="text-secondary h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Online Users</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.onlineUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Mail className="text-accent h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Messages Today</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.messagesTotal}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="text-red-600 h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Warnings</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.warnings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Room Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Room Management</h2>
              <Button onClick={() => setShowCreateRoom(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Room
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Rooms Table */}
        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Active Chat Rooms</h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading rooms...
                      </TableCell>
                    </TableRow>
                  ) : rooms?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No active rooms found
                      </TableCell>
                    </TableRow>
                  ) : (
                    rooms?.map((room: any) => (
                      <TableRow key={room.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
                              <MessageCircle className="text-primary h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{room.name}</div>
                              <div className="text-sm text-gray-500 font-mono">{room.id}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className="text-sm text-gray-900">{room.participantCount}</span>
                            <span className="text-sm text-gray-500 ml-1">
                              / {room.maxParticipants}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-900">
                          {new Date(room.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-gray-900">
                          {room.expiresAt ? new Date(room.expiresAt).toLocaleString() : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewRoom(room)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateQR(room)}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRoom(room.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Room Modal */}
      <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <Label htmlFor="room-name">Room Name</Label>
              <Input
                id="room-name"
                type="text"
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="Custom room name"
                required
              />
            </div>
            <div>
              <Label htmlFor="max-participants">Max Participants</Label>
              <Input
                id="max-participants"
                type="number"
                value={newRoom.maxParticipants}
                onChange={(e) => setNewRoom({ ...newRoom, maxParticipants: parseInt(e.target.value) })}
                min="2"
                max="100"
              />
            </div>
            <div>
              <Label htmlFor="expiration">Expiration Date/Time</Label>
              <Input
                id="expiration"
                type="datetime-local"
                value={newRoom.expiresAt}
                onChange={(e) => setNewRoom({ ...newRoom, expiresAt: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={createRoomMutation.isPending}>
              {createRoomMutation.isPending ? "Creating..." : "Create Room"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Modal */}
      {selectedRoom && (
        <QRModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          room={selectedRoom}
        />
      )}

      {/* Room Details Modal */}
      {selectedRoom && (
        <RoomDetailsModal
          isOpen={showRoomDetails}
          onClose={() => setShowRoomDetails(false)}
          room={selectedRoom}
        />
      )}
    </div>
  );
}
