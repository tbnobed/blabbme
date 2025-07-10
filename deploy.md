# Docker Deployment Guide for blabb.me

## Prerequisites

1. Ubuntu server with Docker and Docker Compose v2 installed
2. Nginx Proxy Manager running with network named "proxy_network"
3. Domain name pointed to your server
4. At least 2GB RAM and 10GB disk space

## Installation Steps

### 1. Install Docker (if not already installed)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose v2
sudo apt install docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 2. Deploy the Application

1. **Upload project files to your server:**
   ```bash
   # Create application directory
   sudo mkdir -p /opt/blabbme
   sudo chown $USER:$USER /opt/blabbme
   cd /opt/blabbme
   
   # Upload all files including:
   # - Dockerfile
   # - docker-compose.yml
   # - init.sql
   # - .dockerignore
   # - All source code files
   ```

2. **Configure environment variables:**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit with secure passwords
   nano .env
   
   # Example .env content:
   POSTGRES_PASSWORD=MySecurePassword123!
   SESSION_SECRET=$(openssl rand -base64 32)
   APP_PORT=5000
   ```

3. **Deploy the application:**
   ```bash
   # Build and start services (this may take a few minutes on first run)
   docker compose up -d --build
   
   # Check service status
   docker compose ps
   
   # Monitor logs to ensure successful startup
   docker compose logs -f app
   docker compose logs -f postgres
   ```

4. **Configure Nginx Proxy Manager:**
   - Add new proxy host in NPM interface
   - Domain: your-domain.com
   - Forward Hostname/IP: blabbme-app-1 (or your server IP)
   - Forward Port: 5000
   - **IMPORTANT: Enable WebSocket Support** (Advanced tab)
   - SSL: Enable with Let's Encrypt
   - Force SSL: Enabled

## Configuration Details

### Environment Variables
- `POSTGRES_PASSWORD`: Database password (change from default)
- `DATABASE_URL`: Automatically configured for Docker setup
- `NODE_ENV`: Set to `production`

### Ports
- Application: 5000 (exposed to host)
- PostgreSQL: 5432 (internal only)

### Volumes
- `postgres_data`: Persistent database storage

### Default Admin Credentials
- Username: `admin`
- Password: `admin123`
- **Important: Change these immediately after deployment**

## Post-Deployment Steps

1. **Change admin password:**
   - Visit: https://your-domain.com/admin
   - Log in with default credentials
   - Change password immediately

2. **Test the application:**
   - Visit: https://your-domain.com
   - Create a test room
   - Verify real-time messaging works

3. **Monitor logs:**
   ```bash
   docker-compose logs -f app
   docker-compose logs -f postgres
   ```

## Maintenance

### Updates
```bash
# Pull latest code
git pull  # or re-upload files

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U blabbme_user blabbme > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U blabbme_user blabbme < backup.sql
```

### View Logs
```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f postgres

# All services
docker-compose logs -f
```

## Troubleshooting

### WebSocket Issues
- Ensure Nginx Proxy Manager has WebSocket support enabled
- Check that port 5000 is accessible
- Verify SSL/TLS configuration if using HTTPS

### Database Connection Issues
- Check PostgreSQL container is running: `docker-compose ps`
- Verify environment variables in .env file
- Check database logs: `docker-compose logs postgres`

### Performance Optimization
- For high traffic, consider:
  - Increasing PostgreSQL memory settings
  - Adding Redis for session storage
  - Implementing horizontal scaling with multiple app instances

## Security Notes

1. Change default admin credentials immediately
2. Use strong database passwords
3. Enable SSL/TLS via Nginx Proxy Manager
4. Consider firewall rules to restrict direct access to port 5000
5. Regular security updates for Docker images
6. Monitor logs for suspicious activity

## Support

For issues or questions:
1. Check application logs: `docker-compose logs -f app`
2. Verify all services are running: `docker-compose ps`
3. Test database connectivity
4. Check Nginx Proxy Manager configuration