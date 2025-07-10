import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by"),
  maxParticipants: integer("max_participants").default(10),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  nickname: text("nickname").notNull(),
  socketId: text("socket_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  nickname: text("nickname").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isFiltered: boolean("is_filtered").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertRoomSchema = z.object({
  name: z.string(),
  createdBy: z.string().nullable().optional(),
  maxParticipants: z.number().optional(),
  expiresAt: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
});

export const insertParticipantSchema = createInsertSchema(participants).omit({
  id: true,
  joinedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
  isFiltered: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
