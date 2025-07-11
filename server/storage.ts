import { admins, rooms, participants, messages, bannedUsers, type Admin, type InsertAdmin, type Room, type InsertRoom, type Participant, type InsertParticipant, type Message, type InsertMessage, type BannedUser, type InsertBannedUser } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt } from "drizzle-orm";

export interface IStorage {
  // Admin methods
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  // Room methods
  getRoom(id: string): Promise<Room | undefined>;
  getAllActiveRooms(): Promise<Room[]>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;
  
  // Participant methods
  getParticipantsByRoom(roomId: string): Promise<Participant[]>;
  addParticipant(participant: InsertParticipant): Promise<Participant>;
  removeParticipant(roomId: string, socketId: string): Promise<boolean>;
  removeParticipantBySocket(socketId: string): Promise<boolean>;
  
  // Message methods
  getMessagesByRoom(roomId: string, limit?: number): Promise<Message[]>;
  addMessage(message: InsertMessage): Promise<Message>;
  
  // Ban methods
  banUser(ban: InsertBannedUser): Promise<BannedUser>;
  isUserBanned(roomId: string, sessionId: string, nickname: string): Promise<boolean>;
  unbanUser(roomId: string, nickname: string): Promise<boolean>;
  getBannedUsers(roomId: string): Promise<BannedUser[]>;
  cleanupExpiredBans(): Promise<void>;
  
  // Cleanup methods
  cleanupExpiredRooms(): Promise<void>;
}

export class MemStorage implements IStorage {
  private admins: Map<number, Admin>;
  private rooms: Map<string, Room>;
  private participants: Map<string, Participant>;
  private messages: Map<number, Message>;
  private bannedUsers: Map<number, BannedUser>;
  private currentAdminId: number;
  private currentParticipantId: number;
  private currentMessageId: number;
  private currentBanId: number;

  constructor() {
    this.admins = new Map();
    this.rooms = new Map();
    this.participants = new Map();
    this.messages = new Map();
    this.bannedUsers = new Map();
    this.currentAdminId = 1;
    this.currentParticipantId = 1;
    this.currentMessageId = 1;
    this.currentBanId = 1;
    
    // Create default admin user
    this.createAdmin({ username: "admin", password: "admin123" });
  }

  async getAdmin(id: number): Promise<Admin | undefined> {
    return this.admins.get(id);
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    return Array.from(this.admins.values()).find(
      (admin) => admin.username === username,
    );
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const id = this.currentAdminId++;
    const admin: Admin = { ...insertAdmin, id, createdAt: new Date() };
    this.admins.set(id, admin);
    return admin;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async getAllActiveRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values()).filter(room => room.isActive);
  }

  async createRoom(insertRoom: any): Promise<Room> {
    const room: Room = {
      name: insertRoom.name,
      id: this.generateRoomId(),
      createdBy: insertRoom.createdBy || null,
      maxParticipants: insertRoom.maxParticipants || 10,
      expiresAt: insertRoom.expiresAt ? new Date(insertRoom.expiresAt) : null,
      createdAt: new Date(),
      isActive: true,
    };
    this.rooms.set(room.id, room);
    return room;
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const room = this.rooms.get(id);
    if (!room) return undefined;
    
    const updatedRoom = { ...room, ...updates };
    this.rooms.set(id, updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(id: string): Promise<boolean> {
    // Remove all participants and messages for this room
    Array.from(this.participants.values())
      .filter(p => p.roomId === id)
      .forEach(p => this.participants.delete(p.id.toString()));
    
    Array.from(this.messages.values())
      .filter(m => m.roomId === id)
      .forEach(m => this.messages.delete(m.id));
    
    return this.rooms.delete(id);
  }

  async getParticipantsByRoom(roomId: string): Promise<Participant[]> {
    return Array.from(this.participants.values()).filter(p => p.roomId === roomId);
  }

  async addParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    const participant: Participant = {
      ...insertParticipant,
      id: this.currentParticipantId++,
      joinedAt: new Date(),
    };
    this.participants.set(participant.id.toString(), participant);
    return participant;
  }

  async removeParticipant(roomId: string, socketId: string): Promise<boolean> {
    const participant = Array.from(this.participants.values())
      .find(p => p.roomId === roomId && p.socketId === socketId);
    
    if (participant) {
      return this.participants.delete(participant.id.toString());
    }
    return false;
  }

  async removeParticipantBySocket(socketId: string): Promise<boolean> {
    const participant = Array.from(this.participants.values())
      .find(p => p.socketId === socketId);
    
    if (participant) {
      return this.participants.delete(participant.id.toString());
    }
    return false;
  }

  async getMessagesByRoom(roomId: string, limit: number = 50): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.roomId === roomId)
      .sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0))
      .slice(-limit);
  }

  async addMessage(insertMessage: InsertMessage): Promise<Message> {
    const message: Message = {
      ...insertMessage,
      id: this.currentMessageId++,
      timestamp: new Date(),
      isFiltered: false,
    };
    this.messages.set(message.id, message);
    return message;
  }

  async banUser(insertBan: InsertBannedUser): Promise<BannedUser> {
    const ban: BannedUser = {
      ...insertBan,
      id: this.currentBanId++,
      bannedAt: new Date(),
    };
    this.bannedUsers.set(ban.id, ban);
    return ban;
  }

  async isUserBanned(roomId: string, sessionId: string, nickname: string): Promise<boolean> {
    const now = new Date();
    
    // Clean up expired bans first
    await this.cleanupExpiredBans();
    
    // Check if user is banned (by session ID or nickname)
    const activeBans = Array.from(this.bannedUsers.values()).filter(ban => 
      ban.roomId === roomId && 
      ban.expiresAt > now &&
      (ban.sessionId === sessionId || ban.nickname === nickname)
    );
    
    return activeBans.length > 0;
  }

  async unbanUser(roomId: string, nickname: string): Promise<boolean> {
    const bansToRemove = Array.from(this.bannedUsers.entries())
      .filter(([_, ban]) => ban.roomId === roomId && ban.nickname === nickname);
    
    for (const [id, _] of bansToRemove) {
      this.bannedUsers.delete(id);
    }
    
    return bansToRemove.length > 0;
  }

  async getBannedUsers(roomId: string): Promise<BannedUser[]> {
    const now = new Date();
    return Array.from(this.bannedUsers.values())
      .filter(ban => ban.roomId === roomId && ban.expiresAt > now);
  }

  async cleanupExpiredBans(): Promise<void> {
    const now = new Date();
    const expiredBans = Array.from(this.bannedUsers.entries())
      .filter(([_, ban]) => ban.expiresAt <= now);
    
    for (const [id, _] of expiredBans) {
      this.bannedUsers.delete(id);
    }
  }

  async cleanupExpiredRooms(): Promise<void> {
    const now = new Date();
    const expiredRooms = Array.from(this.rooms.values())
      .filter(room => room.expiresAt && room.expiresAt < now);
    
    for (const room of expiredRooms) {
      await this.deleteRoom(room.id);
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8);
  }
}

export class DatabaseStorage implements IStorage {
  async getAdmin(id: number): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin || undefined;
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin || undefined;
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const [admin] = await db
      .insert(admins)
      .values(insertAdmin)
      .returning();
    return admin;
  }

  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async getAllActiveRooms(): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.isActive, true));
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const roomData = {
      ...insertRoom,
      id: this.generateRoomId(),
    };
    const [room] = await db
      .insert(rooms)
      .values(roomData)
      .returning();
    return room;
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const [room] = await db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, id))
      .returning();
    return room || undefined;
  }

  async deleteRoom(id: string): Promise<boolean> {
    // Delete participants first
    await db.delete(participants).where(eq(participants.roomId, id));
    // Delete messages
    await db.delete(messages).where(eq(messages.roomId, id));
    // Delete room
    const result = await db.delete(rooms).where(eq(rooms.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getParticipantsByRoom(roomId: string): Promise<Participant[]> {
    return await db.select().from(participants).where(eq(participants.roomId, roomId));
  }

  async addParticipant(insertParticipant: InsertParticipant): Promise<Participant> {
    try {
      const [participant] = await db
        .insert(participants)
        .values(insertParticipant)
        .returning();
      return participant;
    } catch (error: any) {
      // Handle duplicate socket_id constraint violation
      if (error.code === '23505' && error.constraint === 'participants_socket_id_key') {
        // Remove existing participant with this socket_id and try again
        await this.removeParticipantBySocket(insertParticipant.socketId);
        const [participant] = await db
          .insert(participants)
          .values(insertParticipant)
          .returning();
        return participant;
      }
      throw error;
    }
  }

  async removeParticipant(roomId: string, socketId: string): Promise<boolean> {
    const result = await db
      .delete(participants)
      .where(and(eq(participants.roomId, roomId), eq(participants.socketId, socketId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async removeParticipantBySocket(socketId: string): Promise<boolean> {
    const result = await db
      .delete(participants)
      .where(eq(participants.socketId, socketId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getMessagesByRoom(roomId: string, limit: number = 50): Promise<Message[]> {
    // Get the most recent messages but return them in chronological order
    const recentMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(desc(messages.timestamp))
      .limit(limit);
    
    // Reverse to get chronological order (oldest first)
    return recentMessages.reverse();
  }

  async addMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async banUser(insertBan: InsertBannedUser): Promise<BannedUser> {
    const [ban] = await db
      .insert(bannedUsers)
      .values(insertBan)
      .returning();
    return ban;
  }

  async isUserBanned(roomId: string, sessionId: string, nickname: string): Promise<boolean> {
    const now = new Date();
    
    // First cleanup expired bans
    await this.cleanupExpiredBans();
    
    // Check if user is banned (by session ID OR nickname - either can trigger a ban)
    const activeBans = await db
      .select()
      .from(bannedUsers)
      .where(
        and(
          eq(bannedUsers.roomId, roomId),
          // Check that ban hasn't expired yet
          // Using gt instead of lt because we want expiresAt > now (ban still active)
          // We've already cleaned up expired bans above
        )
      );
    
    // Filter in JavaScript for more complex OR logic
    const matchingBans = activeBans.filter(ban => 
      ban.expiresAt > now && 
      (ban.sessionId === sessionId || ban.nickname === nickname)
    );
    
    return matchingBans.length > 0;
  }

  async unbanUser(roomId: string, nickname: string): Promise<boolean> {
    const result = await db
      .delete(bannedUsers)
      .where(
        and(
          eq(bannedUsers.roomId, roomId),
          eq(bannedUsers.nickname, nickname)
        )
      );
    
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getBannedUsers(roomId: string): Promise<BannedUser[]> {
    const now = new Date();
    return await db
      .select()
      .from(bannedUsers)
      .where(
        and(
          eq(bannedUsers.roomId, roomId),
          // Only active bans (not expired)
          // We use gt because we want expiresAt > now
        )
      )
      .then(bans => bans.filter(ban => ban.expiresAt > now));
  }

  async cleanupExpiredBans(): Promise<void> {
    const now = new Date();
    await db
      .delete(bannedUsers)
      .where(lt(bannedUsers.expiresAt, now));
  }

  async cleanupExpiredRooms(): Promise<void> {
    const now = new Date();
    const expiredRooms = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.isActive, true), lt(rooms.expiresAt, now)));
    
    for (const room of expiredRooms) {
      await this.deleteRoom(room.id);
    }
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8);
  }
}

export const storage = new DatabaseStorage();
