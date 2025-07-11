# Blabb.me - Anonymous Chat Application

## Overview

Blabb.me is a real-time anonymous chat application that allows users to create temporary chat rooms without registration. Users can join rooms via QR codes, participate in group conversations, and administrators can moderate content. The application features a modern web interface built with React and a Node.js backend with WebSocket support for real-time messaging.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for development and building
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent design
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Native WebSocket API for chat functionality

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Real-time**: WebSocket Server (ws library) for chat messaging
- **Session Management**: Cookie-based sessions with express rate limiting
- **Content Moderation**: Bad-words filter for message content

### Database Strategy
- **ORM**: Drizzle ORM for type-safe database operations
- **Dual Database Support**: 
  - Neon PostgreSQL (serverless) for Replit deployment
  - Standard PostgreSQL for Docker/local development
- **Schema**: Shared schema definition for consistent data models across environments

## Key Components

### Core Entities
- **Rooms**: Temporary chat spaces with configurable participant limits and expiration times
- **Participants**: Session-based user management without persistent accounts
- **Messages**: Real-time chat messages with content filtering
- **Admins**: Administrative users for content moderation
- **Banned Users**: Temporary bans with expiration for moderation
- **Warnings**: Content moderation tracking system

### Authentication & Authorization
- **Session-Based**: Stateless sessions using generated session IDs
- **Admin Authentication**: Username/password authentication for administrators
- **Rate Limiting**: Multiple rate limiting strategies for different endpoints

### Real-time Features
- **WebSocket Management**: Per-connection state tracking with room association
- **Message Broadcasting**: Real-time message distribution to room participants
- **Presence Tracking**: Live participant count and status updates
- **Auto-cleanup**: Automatic removal of expired rooms and banned users

## Data Flow

1. **Room Creation**: Users create rooms with optional parameters (name, max participants, expiration)
2. **Session Management**: Automatic session creation and management via cookies
3. **Room Joining**: Users join rooms via room ID, WebSocket connection established
4. **Message Flow**: Messages sent via WebSocket, filtered for content, broadcast to room participants
5. **Moderation Flow**: Admins can kick users, creating temporary bans with expiration
6. **QR Code Generation**: Server-side QR code generation for easy room sharing

## External Dependencies

### Production Dependencies
- **@neondatabase/serverless**: Neon database client for serverless PostgreSQL
- **@radix-ui/***: Component library foundation for UI elements
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm**: Type-safe ORM for database operations
- **express**: Web framework for API and static file serving
- **ws**: WebSocket library for real-time communication
- **bad-words**: Content filtering library
- **qrcode**: QR code generation for room sharing

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking and compilation
- **tailwindcss**: Utility-first CSS framework
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Development Environment
- **Replit**: Primary development platform using Neon serverless PostgreSQL
- **Vite Dev Server**: Hot module replacement and development middleware
- **Environment Variables**: `DATABASE_URL` for database connection

### Production Environment
- **Docker**: Multi-stage containerized deployment
- **Build Process**: 
  1. Vite builds frontend to `dist/public`
  2. esbuild bundles server code to `dist/index.js`
  3. Production image serves static files and API
- **Database**: Standard PostgreSQL in Docker container with initialization scripts
- **Static File Serving**: Express serves built frontend assets

### Build Configuration
- **Frontend**: Vite with React plugin, path aliases for clean imports
- **Backend**: esbuild with external dependencies, ES module output
- **Database Migrations**: Drizzle Kit for schema management and migrations

### Environment Considerations
The application adapts its database client based on the environment:
- Replit/Cloud: Uses Neon serverless with WebSocket configuration
- Docker/Local: Uses standard node-postgres with connection pooling

This dual approach allows seamless development in Replit while supporting traditional deployment environments.