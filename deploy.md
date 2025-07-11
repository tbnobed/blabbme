# Blabb.me Production Deployment Guide

## Overview

This guide explains how to deploy blabb.me to Ubuntu servers using Docker with existing nginx proxy manager integration and HTTPS certificates.

## Prerequisites

- Ubuntu server with Docker and Docker Compose installed
- Nginx Proxy Manager (NPM) already configured
- Domain name with HTTPS certificates
- PostgreSQL 15+ support

## Quick Deployment

1. **Clone and Configure**
   ```bash
   git clone <your-repo-url> blabbme
   cd blabbme
   
   # Create environment file
   cp .env.example .env
   
   # Edit environment variables
   nano .env
   ```

2. **Set Environment Variables**
   ```bash
   # Required variables in .env
   POSTGRES_PASSWORD=your_secure_password_here
   SESSION_SECRET=your_very_long_random_session_secret_here
   APP_PORT=5000  # Internal port (NPM will proxy to this)
   ```

3. **Deploy with Docker Compose**
   ```bash
   # Start the application
   docker-compose up -d
   
   # Check logs
   docker-compose logs -f
   ```

## Nginx Proxy Manager Integration

### NPM Configuration

1. **Add Proxy Host in NPM**
   - Domain: your-domain.com
   - Scheme: http
   - Forward Hostname/IP: Your server's IP
   - Forward Port: 5000 (or your APP_PORT)
   - Enable "Websockets Support" (Important for real-time chat!)

2. **SSL Certificate**
   - Request SSL certificate through NPM
   - Enable "Force SSL" and "HTTP/2 Support"

### Advanced NPM Settings (Optional)

Add these to the "Advanced" tab in NPM:

```nginx
# WebSocket support for real-time features
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Increase timeouts for long-lived connections
proxy_read_timeout 86400;
proxy_send_timeout 86400;
```

## Database Features

### New Auto-Ban System

- **Automatic Bans**: Users get 10-minute bans after 3 warnings in 24 hours
- **Progressive Warnings**: Shows "Warning 1/3", "Warning 2/3", then auto-ban
- **Real-time Notifications**: Room-wide notifications for automatic bans

### Migration Handling

The deployment automatically handles database migrations:

- **Fresh Deployments**: Complete schema created from `init.sql`
- **Existing Deployments**: Automatic migration adds warnings and banned_users tables
- **Backward Compatible**: Safe to deploy over existing installations

### Admin Dashboard

- **URL**: https://your-domain.com/admin
- **Credentials**: username `admin`, password `admin123`
- **Features**:
  - Real-time warnings statistics
  - Daily and total warning counts
  - Room management
  - User ban management

## Container Architecture

### Services

1. **PostgreSQL Database**
   - Image: postgres:15-alpine
   - Persistent storage with docker volume
   - Optimized for chat application workload
   - Automatic schema initialization

2. **Node.js Application**
   - Multi-stage Alpine-based build
   - Non-root user for security
   - Health checks and automatic restarts
   - WebSocket support for real-time chat

### Security Features

- Non-root container execution
- Session-based authentication
- Rate limiting (1000 requests per 15 minutes)
- Content moderation with profanity filtering
- Automatic ban system for repeat violations

## Monitoring and Maintenance

### Health Checks

- **Application**: `http://your-domain.com/api/health`
- **Database**: Built-in PostgreSQL health checks
- **Container Status**: `docker-compose ps`

### Log Management

```bash
# View application logs
docker-compose logs -f app

# View database logs
docker-compose logs -f postgres

# View specific timeframe
docker-compose logs --since="1h" app
```

### Database Maintenance

```bash
# Connect to database
docker-compose exec postgres psql -U blabbme_user -d blabbme_db

# Run cleanup functions manually
docker-compose exec postgres psql -U blabbme_user -d blabbme_db -c "SELECT cleanup_expired_bans();"
docker-compose exec postgres psql -U blabbme_user -d blabbme_db -c "SELECT cleanup_old_warnings();"
```

## Scaling and Performance

### Resource Requirements

- **Minimum**: 1 CPU, 1GB RAM, 10GB storage
- **Recommended**: 2 CPU, 2GB RAM, 20GB storage
- **High Traffic**: 4+ CPU, 4GB+ RAM, SSD storage

### Performance Optimizations

- PostgreSQL connection pooling
- Database indexes for fast queries
- Compressed logging with rotation
- WebSocket keep-alive for connection stability

## Troubleshooting

### Common Issues

1. **WebSocket Connection Fails**
   - Ensure "Websockets Support" is enabled in NPM
   - Check firewall allows connections on APP_PORT

2. **Database Connection Errors**
   - Verify POSTGRES_PASSWORD in .env matches docker-compose.yml
   - Check database container health: `docker-compose ps`

3. **Migration Failures**
   - Check logs: `docker-compose logs app`
   - Manually run migration: `docker-compose exec app node -e "require('./migrations/001_add_warnings_and_bans.sql')"`

4. **Admin Login Issues**
   - Default credentials: admin/admin123
   - Reset via database: `docker-compose exec postgres psql -U blabbme_user -d blabbme_db -c "UPDATE admins SET password = 'admin123' WHERE username = 'admin';"`

### Performance Issues

1. **High Memory Usage**
   - Check active rooms: Admin dashboard
   - Restart containers: `docker-compose restart`

2. **Slow Database Queries**
   - Monitor with: `docker-compose exec postgres psql -U blabbme_user -d blabbme_db -c "SELECT * FROM pg_stat_activity;"`

### Recovery Procedures

1. **Complete Reset**
   ```bash
   docker-compose down -v  # Removes data!
   docker-compose up -d
   ```

2. **Backup and Restore**
   ```bash
   # Backup
   docker-compose exec postgres pg_dump -U blabbme_user blabbme_db > backup.sql
   
   # Restore
   docker-compose exec -T postgres psql -U blabbme_user blabbme_db < backup.sql
   ```

## Updates and Maintenance

### Application Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and redeploy
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check deployment
docker-compose logs -f app
```

### Security Updates

- Regularly update Docker images
- Monitor for security advisories
- Keep NPM and host system updated
- Review access logs periodically

## Support

For issues or questions:
- Check application logs first
- Review this deployment guide
- Verify NPM WebSocket configuration
- Test database connectivity

The application includes comprehensive error logging and automatic recovery mechanisms for most common issues.