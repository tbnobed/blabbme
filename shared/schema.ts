import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by"),
  maxParticipants: integer("max_participants").default(10),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  nickname: text("nickname").notNull(),
  socketId: text("socket_id").notNull(),
  joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  nickname: text("nickname").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
  isFiltered: boolean("is_filtered").default(false),
});

// Banned users table for temporary kicks
export const bannedUsers = pgTable("banned_users", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  sessionId: text("session_id"),
  nickname: text("nickname").notNull(),
  bannedAt: timestamp("banned_at", { mode: "date" }).defaultNow(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(), // Ban duration
  reason: text("reason").default("kicked_by_admin"),
});

export const insertAdminSchema = createInsertSchema(admins).pick({
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

export const insertBannedUserSchema = createInsertSchema(bannedUsers).omit({
  id: true,
  bannedAt: true,
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participants.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertBannedUser = z.infer<typeof insertBannedUserSchema>;
export type BannedUser = typeof bannedUsers.$inferSelect;
