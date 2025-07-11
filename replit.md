# blabb.me - Anonymous Chat Application

## Overview

This is a real-time anonymous chat application built with React, Express, and WebSockets. Users can create or join temporary chat rooms without requiring any signup. The application features QR code sharing for easy room access, content moderation, and an admin dashboard for room management.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Content Moderation & Auto-Ban System Implementation (July 11, 2025)
- **Auto-Ban System**: Users automatically banned for 10 minutes after 3 warnings in 24-hour period
- **Progressive Warning System**: Shows "Warning 1/3", "Warning 2/3", then auto-ban on 3rd violation
- **Real-time Ban Notifications**: Room-wide notifications when users get automatically banned
- **Database Warning Tracking**: Complete warning history with original/filtered content and timestamps
- **Enhanced Admin Dashboard**: Real-time warnings statistics showing total and daily counts
- **UTC Timezone Handling**: Fixed timezone issues for accurate "today" warning counts
- **Cache Prevention**: Admin stats refresh every 2 seconds with no-cache headers

## Previous Session Management Improvements
- Extended session timeout from immediate expiration to 2 hours of inactivity
- Added WebSocket keep-alive mechanism with 30-second server pings and 25-second client heartbeats
- Improved reconnection logic with exponential backoff (up to 10 attempts)
- Enhanced session restoration from database when WebSocket reconnects
- Extended session cookies from 24 hours to 7 days
- Added automatic session cleanup to prevent memory leaks

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and bundling

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Real-time Communication**: WebSocket Server for live chat functionality
- **Rate Limiting**: Express rate limiting for API endpoints and message throttling
- **Content Moderation**: Bad-words filter for message content
- **Session Management**: Basic authentication without persistent sessions

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM (Active)
- **Schema Management**: Direct SQL table creation for simplicity
- **Persistent Storage**: DatabaseStorage implementation using PostgreSQL
- **Admin Authentication**: Secure credential storage in admins table
- **Chat History**: All messages saved to database for admin access

## Production Deployment Status
- **Docker Deployment**: Fully operational with self-contained setup
- **Database**: PostgreSQL container with automatic schema initialization and admin user creation
- **Production Server**: Working correctly with entrypoint script handling database setup
- **Build System**: Multi-stage Docker build fully functional with proper Alpine configuration
- **Network**: Ready for Nginx Proxy Manager integration
- **Admin Authentication**: Automatic admin user creation (admin/admin123) on fresh deployments

## Key Components

### Chat System
- **Real-time Messaging**: WebSocket-based communication for instant messaging
- **Room Management**: Temporary rooms with configurable expiration times
- **Participant Tracking**: Real-time participant count and nickname management
- **Content Filtering**: Automatic profanity filtering with bad-words library

### User Interface
- **Responsive Design**: Mobile-first approach using Tailwind CSS
- **Component Library**: Comprehensive UI components from shadcn/ui
- **Accessibility**: ARIA-compliant components from Radix UI
- **Dark Mode**: CSS variable-based theming support

### Admin Features
- **Authentication**: Simple username/password authentication
- **Room Monitoring**: Real-time room statistics and participant management
- **Room Creation**: Admin ability to create rooms with custom settings
- **QR Code Generation**: Server-side QR code generation for room sharing

### Content Moderation
- **Profanity Filter**: Automatic message filtering using bad-words library
- **Rate Limiting**: Per-IP and per-socket message rate limiting
- **Room Expiration**: Automatic cleanup of expired rooms

## Data Flow

1. **Room Creation**: User creates room → Server generates unique room ID → Room stored in database
2. **Room Joining**: User enters room code/URL → WebSocket connection established → User added to participants
3. **Message Flow**: User sends message → Content filtered → Broadcasted to all room participants → Stored in database
4. **Real-time Updates**: Participant joins/leaves → WebSocket broadcasts updates → UI updates participant count

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database ORM
- **ws**: WebSocket server implementation
- **bad-words**: Content moderation library
- **qrcode**: QR code generation
- **express-rate-limit**: API rate limiting

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **@tanstack/react-query**: Server state management
- **tailwindcss**: Utility-first CSS framework
- **wouter**: Lightweight React router

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type safety
- **tsx**: TypeScript execution for development

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: ESBuild bundles Node.js server to `dist/index.js`
- **Database**: Drizzle migrations stored in `migrations/` directory

### Environment Configuration
- **Development**: Uses tsx for hot reloading
- **Production**: Compiled JavaScript with NODE_ENV=production
- **Database**: Requires DATABASE_URL environment variable

### Hosting Requirements
- **Node.js**: Runtime environment for Express server
- **PostgreSQL**: Database for persistent storage
- **WebSocket Support**: For real-time chat functionality
- **Static File Serving**: For React frontend assets

### Key Features
- **No Signup Required**: Anonymous chat access
- **QR Code Sharing**: Easy room access via mobile devices
- **Temporary Rooms**: Automatic expiration and cleanup
- **Content Moderation**: Built-in profanity filtering
- **Admin Dashboard**: Room management and monitoring
- **Mobile Responsive**: Works across all device sizes