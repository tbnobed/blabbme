# Nginx Proxy Manager Configuration for Blabb.me

## WebSocket Support Settings

When setting up your Blabb.me application in Nginx Proxy Manager, use these **minimal** settings:

### Basic Proxy Host Settings
- **Domain Names**: `your-domain.com` (or subdomain)
- **Scheme**: `http` 
- **Forward Hostname/IP**: `localhost` (or your server IP)
- **Forward Port**: `5000`
- **Websockets Support**: **ON** (toggle this in the basic settings)

### SSL Tab Settings
- **SSL Certificate**: Let's Encrypt (or your preferred certificate)
- **Force SSL**: **ON**
- **HTTP/2 Support**: **ON**

### Advanced Tab - Custom Nginx Configuration

**OPTION 1 - Minimal (Recommended):**
```nginx
proxy_http_version 1.1;
```

**OPTION 2 - If WebSocket issues persist:**
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

**OPTION 3 - If you still have connection issues:**
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;
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

After setting up the proxy with HTTPS, test these endpoints:

1. **Main App**: `https://your-domain.com/`
2. **Health Check**: `https://your-domain.com/api/health`
3. **Admin Login**: `https://your-domain.com/admin/login`
4. **WebSocket**: Should connect automatically as `wss://your-domain.com/ws`

### HTTPS Notes

- WebSocket connections will automatically use `wss://` (secure WebSocket) with HTTPS
- Session cookies are automatically set to secure when HTTPS is detected
- No additional server configuration needed - the app detects HTTPS from proxy headers

### Troubleshooting

If you experience session expiration issues:

1. Check browser developer console for WebSocket connection errors
2. Verify the custom Nginx configuration is applied
3. Ensure ports 80 and 443 are accessible
4. Check that your domain DNS points to your server

The session management improvements should significantly reduce premature session expiration, even through Nginx Proxy Manager.