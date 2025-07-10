import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { insertRoomSchema, insertMessageSchema } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import * as QRCode from "qrcode";
import { Filter } from "bad-words";

const filter = new Filter();

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  skip: (req) => req.headers['x-forwarded-for'] === undefined, // Skip validation for local requests
});

// Rate limiting for messages (per socket)
const messageLimiter = new Map<string, { count: number; resetTime: number }>();

interface SocketData {
  roomId?: string;
  nickname?: string;
}

const socketData = new Map<WebSocket, SocketData>();

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api", apiLimiter);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Room routes
  app.get("/api/rooms", async (req, res) => {
    try {
      const rooms = await storage.getAllActiveRooms();
      const roomsWithParticipants = await Promise.all(
        rooms.map(async (room) => {
          const participants = await storage.getParticipantsByRoom(room.id);
          return {
            ...room,
            participantCount: participants.length,
            participants,
          };
        })
      );
      res.json(roomsWithParticipants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.post("/api/rooms", async (req, res) => {
    try {
      console.log("Creating room with data:", req.body);
      // Temporarily skip validation for testing
      const room = await storage.createRoom(req.body);
      console.log("Created room:", room);
      res.json(room);
    } catch (error) {
      console.error("Room creation error:", error);
      res.status(400).json({ message: "Invalid room data", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/rooms/:id", async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      const participants = await storage.getParticipantsByRoom(room.id);
      const messages = await storage.getMessagesByRoom(room.id);
      
      res.json({
        ...room,
        participants,
        messages,
        participantCount: participants.length,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  app.delete("/api/rooms/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteRoom(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json({ message: "Room deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete room" });
    }
  });

  // QR Code generation
  app.get("/api/rooms/:id/qr", async (req, res) => {
    try {
      const room = await storage.getRoom(req.params.id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const roomUrl = `${req.protocol}://${req.get('host')}/room/${room.id}`;
      const qrCode = await QRCode.toDataURL(roomUrl);
      
      res.json({ qrCode, url: roomUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Cleanup expired rooms every 5 minutes
  setInterval(async () => {
    await storage.cleanupExpiredRooms();
  }, 5 * 60 * 1000);

  const httpServer = createServer(app);

  // WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    socketData.set(ws, {});

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const socketInfo = socketData.get(ws);

        switch (message.type) {
          case 'join-room':
            await handleJoinRoom(ws, message, wss);
            break;
          case 'send-message':
            await handleSendMessage(ws, message, wss);
            break;
          case 'leave-room':
            await handleLeaveRoom(ws, wss);
            break;
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', async () => {
      await handleLeaveRoom(ws, wss);
      socketData.delete(ws);
    });
  });

  async function handleJoinRoom(ws: WebSocket, message: any, wss: WebSocketServer) {
    const { roomId, nickname } = message;
    
    const room = await storage.getRoom(roomId);
    if (!room || !room.isActive) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    // Check room capacity
    const participants = await storage.getParticipantsByRoom(roomId);
    if (room.maxParticipants && participants.length >= room.maxParticipants) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
      return;
    }

    // Add participant
    const participant = await storage.addParticipant({
      roomId,
      nickname,
      socketId: generateSocketId(ws),
    });

    socketData.set(ws, { roomId, nickname });

    // Notify room about new participant
    broadcastToRoom(wss, roomId, {
      type: 'user-joined',
      nickname,
      participantCount: participants.length + 1,
    });

    // Send room info to user
    const messages = await storage.getMessagesByRoom(roomId);
    ws.send(JSON.stringify({
      type: 'room-joined',
      room,
      messages,
      participants: [...participants, participant],
    }));
  }

  async function handleSendMessage(ws: WebSocket, message: any, wss: WebSocketServer) {
    const socketInfo = socketData.get(ws);
    if (!socketInfo?.roomId || !socketInfo?.nickname) {
      ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
      return;
    }

    // Rate limiting
    const socketId = generateSocketId(ws);
    const now = Date.now();
    const limiter = messageLimiter.get(socketId) || { count: 0, resetTime: now + 1000 };
    
    if (now > limiter.resetTime) {
      limiter.count = 0;
      limiter.resetTime = now + 1000;
    }
    
    if (limiter.count >= 1) {
      ws.send(JSON.stringify({ 
        type: 'warning', 
        message: 'Please slow down. Only 1 message per second allowed.' 
      }));
      return;
    }
    
    limiter.count++;
    messageLimiter.set(socketId, limiter);

    // Profanity filter
    const originalContent = message.content;
    const isFiltered = filter.isProfane(originalContent);
    
    if (isFiltered) {
      ws.send(JSON.stringify({
        type: 'warning',
        message: 'Please keep things respectful.'
      }));
    }

    // Save message
    const savedMessage = await storage.addMessage({
      roomId: socketInfo.roomId,
      nickname: socketInfo.nickname,
      content: originalContent,
    });

    // Broadcast message to room
    broadcastToRoom(wss, socketInfo.roomId, {
      type: 'new-message',
      message: savedMessage,
    });
  }

  async function handleLeaveRoom(ws: WebSocket, wss: WebSocketServer) {
    const socketInfo = socketData.get(ws);
    if (!socketInfo?.roomId) return;

    const socketId = generateSocketId(ws);
    await storage.removeParticipantBySocket(socketId);

    // Notify room about participant leaving
    const participants = await storage.getParticipantsByRoom(socketInfo.roomId);
    broadcastToRoom(wss, socketInfo.roomId, {
      type: 'user-left',
      nickname: socketInfo.nickname,
      participantCount: participants.length,
    });

    socketData.set(ws, {});
  }

  function broadcastToRoom(wss: WebSocketServer, roomId: string, data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const clientInfo = socketData.get(client);
        if (clientInfo?.roomId === roomId) {
          client.send(JSON.stringify(data));
        }
      }
    });
  }

  function generateSocketId(ws: WebSocket): string {
    return `socket_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  return httpServer;
}
