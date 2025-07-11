# Nginx Proxy Manager Configuration for Blabb.me

## WebSocket Support Settings

When setting up your Blabb.me application in Nginx Proxy Manager, use these settings to ensure WebSocket connections work properly:

### Basic Proxy Host Settings
- **Domain Names**: `your-domain.com` (or subdomain)
- **Scheme**: `http` 
- **Forward Hostname/IP**: `localhost` (or your server IP)
- **Forward Port**: `5000`

### Advanced Tab - Custom Nginx Configuration

Add this configuration to support WebSocket connections:

```nginx
# WebSocket upgrade headers
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# WebSocket timeout settings
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
proxy_connect_timeout 60s;

# Session affinity (important for WebSocket)
proxy_set_header X-Forwarded-Host $server_name;
proxy_set_header X-Forwarded-Server $host;

# Prevent proxy buffering for real-time communication
proxy_buffering off;
proxy_cache off;
```

### SSL Certificate
- Enable SSL certificate (Let's Encrypt recommended)
- Force SSL: ON
- HTTP/2 Support: ON

### Important Notes

1. **WebSocket Path**: The application uses `/ws` path for WebSocket connections
2. **Session Persistence**: Sessions are maintained for 2 hours of inactivity
3. **Keep-Alive**: Client sends ping every 25 seconds, server pings every 30 seconds
4. **Automatic Reconnection**: Client will attempt to reconnect up to 10 times with exponential backoff

### Testing Your Configuration

After setting up the proxy, test these endpoints:

1. **Main App**: `https://your-domain.com/`
2. **Health Check**: `https://your-domain.com/api/health`
3. **Admin Login**: `https://your-domain.com/admin/login`
4. **WebSocket**: Should connect automatically when accessing the chat

### Troubleshooting

If you experience session expiration issues:

1. Check browser developer console for WebSocket connection errors
2. Verify the custom Nginx configuration is applied
3. Ensure ports 80 and 443 are accessible
4. Check that your domain DNS points to your server

The session management improvements should significantly reduce premature session expiration, even through Nginx Proxy Manager.