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
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for messages (per socket)
const messageLimiter = new Map<string, { count: number; resetTime: number }>();

interface SocketData {
  roomId?: string;
  nickname?: string;
  sessionId?: string;
}

interface UserSession {
  sessionId: string;
  roomId?: string;
  nickname?: string;
  lastActivity: Date;
}

const socketData = new Map<WebSocket, SocketData>();
const userSessions = new Map<string, UserSession>();

export async function registerRoutes(app: Express): Promise<Server> {
  app.use("/api", apiLimiter);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getAdminByUsername(username);
      
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
      
      // Manually handle the date conversion to avoid Zod transform issues
      const roomData = {
        name: req.body.name,
        createdBy: req.body.createdBy || null,
        maxParticipants: req.body.maxParticipants || 10,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      };
      
      console.log("Processed room data:", roomData);
      console.log("expiresAt type:", typeof roomData.expiresAt, roomData.expiresAt);
      
      const room = await storage.createRoom(roomData);
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

  // Session management endpoints
  app.post("/api/session/create", async (req, res) => {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const session: UserSession = {
        sessionId,
        lastActivity: new Date(),
      };
      
      userSessions.set(sessionId, session);
      
      res.cookie('chat_session', sessionId, {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      });
      
      res.json({ sessionId, session });
    } catch (error) {
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/session/current", async (req, res) => {
    try {
      const sessionId = req.cookies.chat_session;
      if (!sessionId) {
        return res.status(404).json({ message: "No session found" });
      }
      
      const session = userSessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session expired" });
      }
      
      // Update last activity
      session.lastActivity = new Date();
      
      res.json({ sessionId, session });
    } catch (error) {
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  app.delete("/api/session/current", async (req, res) => {
    try {
      const sessionId = req.cookies.chat_session;
      if (sessionId) {
        userSessions.delete(sessionId);
      }
      
      res.clearCookie('chat_session');
      res.json({ message: "Session cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear session" });
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
    console.log('WebSocket connection established');
    socketData.set(ws, {});

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received WebSocket message:', message);
        const socketInfo = socketData.get(ws);

        switch (message.type) {
          case 'init-session':
            await handleInitSession(ws, message);
            break;
          case 'join-room':
            console.log('Handling join-room for:', message.roomId, message.nickname);
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
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', async () => {
      await handleLeaveRoom(ws, wss);
      socketData.delete(ws);
    });
  });

  async function handleInitSession(ws: WebSocket, message: any) {
    const { sessionId } = message;
    
    if (sessionId && userSessions.has(sessionId)) {
      const session = userSessions.get(sessionId)!;
      socketData.set(ws, { 
        sessionId,
        roomId: session.roomId,
        nickname: session.nickname 
      });
      
      // Update session activity
      session.lastActivity = new Date();
      
      // If user was in a room, reconnect them
      if (session.roomId && session.nickname) {
        const room = await storage.getRoom(session.roomId);
        if (room && room.isActive) {
          // Add back to participants if not already there
          const participants = await storage.getParticipantsByRoom(session.roomId);
          const existingParticipant = participants.find(p => p.nickname === session.nickname);
          
          if (!existingParticipant) {
            // Add participant back to the room
            await storage.addParticipant({
              roomId: session.roomId,
              nickname: session.nickname,
              socketId: generateSocketId(ws),
            });
            
            // Notify room about reconnected participant
            broadcastToRoom(wss, session.roomId, {
              type: 'user-joined',
              nickname: session.nickname,
              participantCount: participants.length + 1,
            });
          }
          
          const messages = await storage.getMessagesByRoom(session.roomId);
          const updatedParticipants = await storage.getParticipantsByRoom(session.roomId);
          
          ws.send(JSON.stringify({
            type: 'session-restored',
            room,
            messages,
            participants: updatedParticipants,
            nickname: session.nickname,
          }));
          return;
        }
      }
    }
    
    ws.send(JSON.stringify({ type: 'session-initialized', sessionId }));
  }

  async function handleJoinRoom(ws: WebSocket, message: any, wss: WebSocketServer) {
    const { roomId, nickname, sessionId } = message;
    console.log('JOIN ROOM: Looking for room:', roomId, 'with nickname:', nickname, 'sessionId:', sessionId);
    
    const room = await storage.getRoom(roomId);
    console.log('JOIN ROOM: Found room:', room);
    
    if (!room || !room.isActive) {
      console.log('JOIN ROOM: Room not found or not active');
      ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
      return;
    }

    // Check if this is a session restoration (user already in room)
    const socketInfo = socketData.get(ws);
    if (socketInfo?.roomId === roomId && socketInfo?.nickname === nickname) {
      console.log('JOIN ROOM: User already in room via session restoration, skipping duplicate join');
      return;
    }

    // Check room capacity
    const participants = await storage.getParticipantsByRoom(roomId);
    
    // Check if user is already in the room (prevent duplicates)
    const existingParticipant = participants.find(p => p.nickname === nickname);
    if (existingParticipant) {
      // Update existing participant's socket ID
      console.log('JOIN ROOM: Updating existing participant socket ID');
      await storage.removeParticipant(roomId, existingParticipant.socketId);
    } else if (room.maxParticipants && participants.length >= room.maxParticipants) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
      return;
    }

    // Add participant (or re-add with new socket ID)
    const participant = await storage.addParticipant({
      roomId,
      nickname,
      socketId: generateSocketId(ws),
    });

    // Update socket and session data
    socketData.set(ws, { roomId, nickname, sessionId });
    
    if (sessionId && userSessions.has(sessionId)) {
      const session = userSessions.get(sessionId)!;
      session.roomId = roomId;
      session.nickname = nickname;
      session.lastActivity = new Date();
    }

    // Only notify if this is a new participant (not a reconnection)
    if (!existingParticipant) {
      // Notify room about new participant
      broadcastToRoom(wss, roomId, {
        type: 'user-joined',
        nickname,
        participantCount: participants.length + 1,
      });
    }

    // Send room info to user
    const messages = await storage.getMessagesByRoom(roomId);
    const updatedParticipants = await storage.getParticipantsByRoom(roomId);
    ws.send(JSON.stringify({
      type: 'room-joined',
      room,
      messages,
      participants: updatedParticipants,
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

    // Clear session room data when explicitly leaving
    if (socketInfo.sessionId && userSessions.has(socketInfo.sessionId)) {
      const session = userSessions.get(socketInfo.sessionId)!;
      session.roomId = undefined;
      session.nickname = undefined;
      session.lastActivity = new Date();
    }

    // Notify room about participant leaving
    const participants = await storage.getParticipantsByRoom(socketInfo.roomId);
    broadcastToRoom(wss, socketInfo.roomId, {
      type: 'user-left',
      nickname: socketInfo.nickname,
      participantCount: participants.length,
    });

    socketData.set(ws, { sessionId: socketInfo.sessionId });
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
