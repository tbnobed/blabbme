import { users, rooms, participants, messages, type User, type InsertUser, type Room, type InsertRoom, type Participant, type InsertParticipant, type Message, type InsertMessage } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Cleanup methods
  cleanupExpiredRooms(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rooms: Map<string, Room>;
  private participants: Map<string, Participant>;
  private messages: Map<number, Message>;
  private currentUserId: number;
  private currentParticipantId: number;
  private currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.rooms = new Map();
    this.participants = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentParticipantId = 1;
    this.currentMessageId = 1;
    
    // Create default admin user
    this.createUser({ username: "admin", password: "admin123" });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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

export const storage = new MemStorage();
