import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
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
}, (table) => ({
  // Production indexes for hundreds of users
  expiresAtIdx: index("rooms_expires_at_idx").on(table.expiresAt),
  isActiveIdx: index("rooms_is_active_idx").on(table.isActive),
  createdAtIdx: index("rooms_created_at_idx").on(table.createdAt),
}));

export const participants = pgTable("participants", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  nickname: text("nickname").notNull(),
  socketId: text("socket_id").notNull(),
  joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  // Critical indexes for real-time participant lookups
  roomIdIdx: index("participants_room_id_idx").on(table.roomId),
  socketIdIdx: index("participants_socket_id_idx").on(table.socketId),
  roomNicknameIdx: index("participants_room_nickname_idx").on(table.roomId, table.nickname),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  nickname: text("nickname").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
  isFiltered: boolean("is_filtered").default(false),
}, (table) => ({
  // High-performance indexes for message retrieval
  roomIdTimestampIdx: index("messages_room_id_timestamp_idx").on(table.roomId, table.timestamp),
  timestampIdx: index("messages_timestamp_idx").on(table.timestamp),
}));

// Banned users table for temporary kicks
export const bannedUsers = pgTable("banned_users", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  sessionId: text("session_id"),
  nickname: text("nickname").notNull(),
  bannedAt: timestamp("banned_at", { mode: "date" }).defaultNow(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(), // Ban duration
  reason: text("reason").default("kicked_by_admin"),
}, (table) => ({
  // Fast ban checks for hundreds of users
  roomSessionIdx: index("banned_users_room_session_idx").on(table.roomId, table.sessionId),
  expiresAtIdx: index("banned_users_expires_at_idx").on(table.expiresAt),
  roomNicknameIdx: index("banned_users_room_nickname_idx").on(table.roomId, table.nickname),
}));

// Warnings table for tracking content moderation
export const warnings = pgTable("warnings", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  sessionId: text("session_id"),
  nickname: text("nickname").notNull(),
  originalMessage: text("original_message").notNull(),
  filteredMessage: text("filtered_message").notNull(),
  warningType: text("warning_type").notNull().default("profanity"), // profanity, spam, etc
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
}, (table) => ({
  // Efficient moderation queries
  roomSessionIdx: index("warnings_room_session_idx").on(table.roomId, table.sessionId),
  createdAtIdx: index("warnings_created_at_idx").on(table.createdAt),
  warningTypeIdx: index("warnings_type_idx").on(table.warningType),
}));

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

export const insertWarningSchema = createInsertSchema(warnings).omit({
  id: true,
  createdAt: true,
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
export type InsertWarning = z.infer<typeof insertWarningSchema>;
export type Warning = typeof warnings.$inferSelect;

// Production health monitoring table for hundreds of users
export const systemHealth = pgTable("system_health", {
  id: serial("id").primaryKey(),
  metric: text("metric").notNull(), // 'active_rooms', 'total_users', 'push_notifications', etc
  value: integer("value").notNull(),
  timestamp: timestamp("timestamp", { mode: "date" }).defaultNow(),
}, (table) => ({
  metricTimestampIdx: index("system_health_metric_timestamp_idx").on(table.metric, table.timestamp),
  timestampIdx: index("system_health_timestamp_idx").on(table.timestamp),
}));

export type SystemHealth = typeof systemHealth.$inferSelect;
export const insertSystemHealthSchema = createInsertSchema(systemHealth).omit({
  id: true,
  timestamp: true,
});
