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

// Rate limiting for API routes - more lenient for normal usage
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 100 to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Special rate limiter for session and room endpoints (even more lenient)
const sessionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 500, // 500 requests per 5 minutes for sessions/rooms
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
  // Apply general rate limiting to all API routes
  app.use("/api", apiLimiter);
  
  // Apply more lenient rate limiting to session and room endpoints
  app.use("/api/session", sessionLimiter);
  app.use("/api/rooms", sessionLimiter);

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }
      
      const admin = await storage.getAdminByUsername(username);
      if (!admin || admin.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Set session cookie for admin
      res.cookie('admin_session', admin.id.toString(), {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
      });
      
      res.json({ 
        message: "Login successful", 
        admin: { id: admin.id, username: admin.username } 
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      res.clearCookie('admin_session');
      res.json({ message: "Logout successful" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/check", async (req, res) => {
    try {
      const adminId = req.cookies.admin_session;
      if (!adminId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const admin = await storage.getAdmin(parseInt(adminId));
      if (!admin) {
        res.clearCookie('admin_session');
        return res.status(401).json({ message: "Invalid session" });
      }
      
      res.json({ 
        admin: { id: admin.id, username: admin.username } 
      });
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
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https', // Auto-detect HTTPS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
      
      let session = userSessions.get(sessionId);
      
      // If session not in memory, try to restore from database
      if (!session) {
        const allRooms = await storage.getAllActiveRooms();
        for (const room of allRooms) {
          const participants = await storage.getParticipantsByRoom(room.id);
          const existingParticipant = participants.find(p => p.socketId.includes(sessionId));
          
          if (existingParticipant) {
            // Recreate session from participant data
            session = {
              sessionId,
              roomId: room.id,
              nickname: existingParticipant.nickname,
              lastActivity: new Date(),
            };
            userSessions.set(sessionId, session);
            console.log('API session restoration: Restored session from database');
            break;
          }
        }
      }
      
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

  // Admin Statistics endpoint
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const adminId = req.cookies.admin_session;
      if (!adminId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const rooms = await storage.getAllActiveRooms();
      let totalMessages = 0;
      let totalParticipants = 0;
      let messagesLast24h = 0;

      // Calculate statistics
      for (const room of rooms) {
        const participants = await storage.getParticipantsByRoom(room.id);
        totalParticipants += participants.length;
        
        const messages = await storage.getMessagesByRoom(room.id, 1000); // Get more messages for counting
        totalMessages += messages.length;
        
        // Count messages from last 24 hours
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentMessages = messages.filter(msg => new Date(msg.timestamp) > last24h);
        messagesLast24h += recentMessages.length;
      }

      // Get warnings count for moderation tracking
      const totalWarnings = await storage.getWarningsCount('all');
      const warningsToday = await storage.getWarningsCount('today');
      

      
      const stats = {
        activeRooms: rooms.length,
        onlineUsers: totalParticipants,
        totalMessages,
        messagesLast24h,
        warnings: totalWarnings,
        warningsToday,
      };

      // Prevent caching of admin stats
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Kick participant from room (admin only)
  app.delete("/api/rooms/:roomId/participants/:participantId", async (req, res) => {
    try {
      const { roomId, participantId } = req.params;
      
      // Get participant info before removing
      const participants = await storage.getParticipantsByRoom(roomId);
      const participant = participants.find(p => p.id.toString() === participantId);
      
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      
      // Create a temporary ban (30 minutes)
      const banExpiry = new Date();
      banExpiry.setMinutes(banExpiry.getMinutes() + 30);
      
      // Find session ID from socket data
      let sessionId = 'unknown';
      const wss = (req.app as any).wss;
      wss.clients.forEach((client) => {
        const clientData = socketData.get(client);
        if (clientData?.roomId === roomId && clientData?.nickname === participant.nickname) {
          sessionId = clientData.sessionId || 'unknown';
        }
      });
      
      console.log('Creating ban for:', { roomId, sessionId, nickname: participant.nickname, expiresAt: banExpiry });
      
      // Ban the user
      try {
        await storage.banUser({
          roomId,
          sessionId,
          nickname: participant.nickname,
          expiresAt: banExpiry,
          reason: 'kicked_by_admin'
        });
        console.log('Ban created successfully');
      } catch (error) {
        console.error('Failed to create ban:', error);
      }
      
      // Remove participant from database
      const removed = await storage.removeParticipant(roomId, participant.socketId);
      
      if (removed) {
        // Find and close WebSocket connection for this participant
        wss.clients.forEach((client) => {
          const clientData = socketData.get(client);
          if (clientData?.roomId === roomId && clientData?.nickname === participant.nickname) {
            // Send kick notification to the user being kicked
            client.send(JSON.stringify({
              type: 'kicked',
              message: 'You have been removed from the room and temporarily banned for 30 minutes'
            }));
            
            // Update their socket data to remove room info
            socketData.set(client, { 
              sessionId: clientData.sessionId,
              roomId: undefined, 
              nickname: undefined 
            });
          }
        });
        
        // Broadcast to remaining participants
        broadcastToRoom(wss, roomId, {
          type: 'user-left',
          nickname: participant.nickname,
          reason: 'kicked'
        });
        
        res.json({ message: "Participant removed successfully" });
      } else {
        res.status(500).json({ message: "Failed to remove participant" });
      }
    } catch (error) {
      console.error("Error kicking participant:", error);
      res.status(500).json({ message: "Failed to remove participant" });
    }
  });

  // Unban user from room (admin only)
  app.delete("/api/rooms/:roomId/bans/:nickname", async (req, res) => {
    try {
      const { roomId, nickname } = req.params;
      
      const unbanned = await storage.unbanUser(roomId, nickname);
      
      if (unbanned) {
        res.json({ message: "User unbanned successfully" });
      } else {
        res.status(404).json({ message: "No active ban found for this user" });
      }
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  // Get banned users for a room (admin only)
  app.get("/api/rooms/:roomId/bans", async (req, res) => {
    try {
      const { roomId } = req.params;
      
      const bannedUsers = await storage.getBannedUsers(roomId);
      res.json(bannedUsers);
    } catch (error) {
      console.error("Error fetching banned users:", error);
      res.status(500).json({ message: "Failed to fetch banned users" });
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
  
  // Make wss accessible to route handlers
  (app as any).wss = wss;

  // Store session data and socket mappings
  const socketData = new Map<WebSocket, SocketData>();
  const userSessions = new Map<string, UserSession>();
  const messageLimiter = new Map<string, { count: number; resetTime: number }>();

  // Cleanup expired sessions every 10 minutes (sessions expire after 2 hours of inactivity)
  setInterval(() => {
    const now = new Date();
    const sessionTimeout = 2 * 60 * 60 * 1000; // 2 hours
    
    for (const [sessionId, session] of userSessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > sessionTimeout) {
        console.log(`Cleaning up expired session: ${sessionId}`);
        userSessions.delete(sessionId);
      }
    }
  }, 10 * 60 * 1000);

  // WebSocket keep-alive ping interval (30 seconds)
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000);

  // Additional server-side heartbeat to keep idle browsers alive
  const serverHeartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'server-heartbeat' }));
        } catch (error) {
          console.error('Error sending server heartbeat:', error);
        }
      }
    });
  }, 45000); // Every 45 seconds

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket connection established');
    socketData.set(ws, {});

    // Set up pong handler for keep-alive
    ws.on('pong', () => {
      // Update last activity for this connection
      const data = socketData.get(ws);
      if (data?.sessionId) {
        const session = userSessions.get(data.sessionId);
        if (session) {
          session.lastActivity = new Date();
        }
      }
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Received WebSocket message:', message);
        const socketInfo = socketData.get(ws);

        switch (message.type) {
          case 'ping':
            // Handle client heartbeat - update session activity
            const data = socketData.get(ws);
            if (data?.sessionId) {
              const session = userSessions.get(data.sessionId);
              if (session) {
                session.lastActivity = new Date();
              }
            }
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          case 'heartbeat-ack':
            // Handle heartbeat acknowledgment from client
            const socketInfo = socketData.get(ws);
            if (socketInfo?.sessionId) {
              const session = userSessions.get(socketInfo.sessionId);
              if (session) {
                session.lastActivity = new Date();
              }
            }
            break;
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
            await handleLeaveRoom(ws, wss, message.explicit || false);
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', async () => {
      const socketInfo = socketData.get(ws);
      
      // Only remove participant if this is not a session that will be restored
      if (socketInfo?.roomId && socketInfo?.sessionId && userSessions.has(socketInfo.sessionId)) {
        console.log('WebSocket closed but session exists, keeping participant in room');
        // Don't remove participant - session restoration will handle reconnection
      } else {
        // No session or explicit disconnect - remove participant
        await handleLeaveRoom(ws, wss, false);
      }
      
      socketData.delete(ws);
    });

    // Send initial ping to establish keep-alive
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });

  async function handleInitSession(ws: WebSocket, message: any) {
    const { sessionId } = message;
    
    // Check both in-memory sessions and database participants
    let session = sessionId ? userSessions.get(sessionId) : null;
    
    // If no in-memory session, try to restore from database participants
    if (!session && sessionId) {
      // Look for any active participant with this session ID
      const allRooms = await storage.getAllActiveRooms();
      for (const room of allRooms) {
        const participants = await storage.getParticipantsByRoom(room.id);
        const existingParticipant = participants.find(p => p.socketId.includes(sessionId));
        
        if (existingParticipant) {
          // Recreate session from participant data
          session = {
            sessionId,
            roomId: room.id,
            nickname: existingParticipant.nickname,
            lastActivity: new Date(),
          };
          userSessions.set(sessionId, session);
          console.log('Session restoration: Restored session from database participant');
          break;
        }
      }
    }
    
    console.log('handleInitSession: sessionId:', sessionId, 'session found:', !!session);
    
    if (session) {
      socketData.set(ws, { 
        sessionId,
        roomId: session.roomId,
        nickname: session.nickname 
      });
      
      // Update session activity
      session.lastActivity = new Date();
      
      // If user was in a room, check if they can reconnect (not banned)
      if (session.roomId && session.nickname) {
        const room = await storage.getRoom(session.roomId);
        if (room && room.isActive) {
          // Check if user is banned before restoring session
          const isBanned = await storage.isUserBanned(session.roomId, sessionId || 'unknown', session.nickname);
          if (isBanned) {
            console.log('Session restoration: User is banned, clearing session');
            // Clear the session since user is banned
            userSessions.delete(sessionId);
            socketData.set(ws, { sessionId });
            ws.send(JSON.stringify({ 
              type: 'session-initialized', 
              sessionId,
              message: 'You are temporarily banned from your previous room.' 
            }));
            return;
          }
          
          // Check if participant is still in the room
          const participants = await storage.getParticipantsByRoom(session.roomId);
          let existingParticipant = participants.find(p => p.nickname === session.nickname);
          
          if (!existingParticipant) {
            // Add participant back to the room
            await storage.addParticipant({
              roomId: session.roomId,
              nickname: session.nickname,
              socketId: generateSocketId(ws, sessionId),
            });
            console.log('Session restoration: Re-added participant to room');
          } else {
            // Update existing participant's socket ID for reconnection
            await storage.removeParticipant(session.roomId, existingParticipant.socketId);
            await storage.addParticipant({
              roomId: session.roomId,
              nickname: session.nickname,
              socketId: generateSocketId(ws, sessionId),
            });
            console.log('Session restoration: Updated participant socket ID');
          }
          
          const messages = await storage.getMessagesByRoom(session.roomId);
          const updatedParticipants = await storage.getParticipantsByRoom(session.roomId);
          
          const restorationData = {
            type: 'session-restored',
            room,
            messages,
            participants: updatedParticipants,
            nickname: session.nickname,
          };
          
          console.log('Sending session-restored message to client, room:', session.roomId, 'nickname:', session.nickname);
          ws.send(JSON.stringify(restorationData));
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

    // Check if user is banned from this room
    if (nickname) {
      console.log('Checking ban status for:', { roomId, sessionId, nickname });
      const isBanned = await storage.isUserBanned(roomId, sessionId || 'unknown', nickname);
      console.log('Ban check result:', isBanned);
      if (isBanned) {
        console.log('JOIN ROOM: User is banned from room');
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'You are temporarily banned from this room. Please try again later.' 
        }));
        return;
      }
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
      socketId: generateSocketId(ws, sessionId),
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
      // Track warning when content is filtered
      const warning = await storage.addWarning({
        roomId: socketInfo.roomId,
        sessionId: socketInfo.sessionId || null,
        nickname: socketInfo.nickname,
        originalMessage: originalContent,
        filteredMessage: filter.clean(originalContent),
        warningType: 'profanity',
      });
      

      
      // Check user's warning count - auto-ban after 3 warnings
      const userWarnings = await storage.getUserWarningsCount(
        socketInfo.roomId,
        socketInfo.sessionId || '',
        socketInfo.nickname
      );
      
      if (userWarnings >= 3) {
        // Auto-ban user for 10 minutes
        const banExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await storage.banUser({
          roomId: socketInfo.roomId,
          sessionId: socketInfo.sessionId || null,
          nickname: socketInfo.nickname,
          expiresAt: banExpiresAt,
          reason: 'automatic_ban_3_warnings',
        });
        
        // Notify room about the ban
        broadcastToRoom(wss, socketInfo.roomId, {
          type: 'user-banned',
          nickname: socketInfo.nickname,
          reason: 'Automatic ban after 3 warnings',
          duration: '10 minutes'
        });
        
        // Remove user from room
        await handleLeaveRoom(ws, wss, true);
        
        ws.send(JSON.stringify({
          type: 'error',
          message: 'You have been temporarily banned for 10 minutes due to repeated inappropriate content violations.'
        }));
        
        // Close the connection
        ws.close();
        return;
      }
      
      ws.send(JSON.stringify({
        type: 'warning',
        message: `Please keep things respectful. Warning ${userWarnings}/3 - 3 warnings result in a 10-minute ban.`
      }));
      return;
    }

    // Save message
    const savedMessage = await storage.addMessage({
      roomId: socketInfo.roomId,
      nickname: socketInfo.nickname,
      content: originalContent,
    });

    // Broadcast message to room
    console.log('Broadcasting new message from', socketInfo.nickname, 'to room', socketInfo.roomId);
    broadcastToRoom(wss, socketInfo.roomId, {
      type: 'new-message',
      message: savedMessage,
    });
  }

  async function handleLeaveRoom(ws: WebSocket, wss: WebSocketServer, isExplicit: boolean = false) {
    const socketInfo = socketData.get(ws);
    if (!socketInfo?.roomId) return;

    const socketId = generateSocketId(ws);
    await storage.removeParticipantBySocket(socketId);

    // Only clear session and broadcast if this was an explicit leave (not a disconnection/refresh)
    if (isExplicit && socketInfo.sessionId && userSessions.has(socketInfo.sessionId)) {
      const session = userSessions.get(socketInfo.sessionId)!;
      session.roomId = undefined;
      session.nickname = undefined;
      session.lastActivity = new Date();

      // Notify room about participant leaving only for explicit leaves
      const participants = await storage.getParticipantsByRoom(socketInfo.roomId);
      broadcastToRoom(wss, socketInfo.roomId, {
        type: 'user-left',
        nickname: socketInfo.nickname,
        participantCount: participants.length,
      });
    }

    socketData.set(ws, { sessionId: socketInfo.sessionId });
  }

  function broadcastToRoom(wss: WebSocketServer, roomId: string, data: any) {
    console.log('Broadcasting to room:', roomId, 'data type:', data.type);
    let broadcastCount = 0;
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        const clientInfo = socketData.get(client);
        if (clientInfo?.roomId === roomId) {
          try {
            client.send(JSON.stringify(data));
            broadcastCount++;
          } catch (error) {
            console.error('Error broadcasting to client:', error);
          }
        }
      }
    });
    
    console.log('Broadcasted to', broadcastCount, 'clients in room', roomId);
  }

  function generateSocketId(ws: WebSocket, sessionId?: string): string {
    const wsData = socketData.get(ws);
    const id = sessionId || wsData?.sessionId || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return `socket_${id}`;
  }

  return httpServer;
}
