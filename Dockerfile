# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies including Python for native modules
RUN apk add --no-cache python3 make g++ linux-headers

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Define build arguments for Vite environment variables
ARG VITE_SHOW_HERO_DESCRIPTION=true
ARG VITE_SHOW_FEATURES_SECTION=true
ARG VITE_SHOW_START_NEW_CHAT_BUTTON=true
ARG VITE_SHOW_JOIN_CHAT_BUTTON=true

# Set environment variables for the build
ENV VITE_SHOW_HERO_DESCRIPTION=${VITE_SHOW_HERO_DESCRIPTION}
ENV VITE_SHOW_FEATURES_SECTION=${VITE_SHOW_FEATURES_SECTION}
ENV VITE_SHOW_START_NEW_CHAT_BUTTON=${VITE_SHOW_START_NEW_CHAT_BUTTON}
ENV VITE_SHOW_JOIN_CHAT_BUTTON=${VITE_SHOW_JOIN_CHAT_BUTTON}

# Build the frontend using vite config defaults
RUN npx vite build

# Copy PWA files to the build output directory
RUN echo "=== Copying PWA files to dist/public ===" && \
    mkdir -p dist/public && \
    cp client/public/manifest.json dist/public/ 2>/dev/null || echo "manifest.json not found, skipping" && \
    cp client/public/sw.js dist/public/ 2>/dev/null || echo "sw.js not found, skipping" && \
    cp client/public/icon-*.png dist/public/ 2>/dev/null || echo "icons not found, skipping"

# Debug: Check what actually got built
RUN echo "=== Debug: Checking build output ===" && \
    ls -la dist/ && \
    echo "=== PWA files in dist/public ===" && \
    ls -la dist/public/ | grep -E "(manifest|sw|icon)" || echo "No PWA files found" && \
    echo "=== Looking for any built files ===" && \
    find . -name "*.html" -o -name "*.js" -o -name "*.css" | grep -v node_modules | head -10

# Build the server
RUN node build-server.js

# Verify complete build
RUN echo "=== Final dist contents ===" && ls -la dist/

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init postgresql-client curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S appuser -u 1001 -G nodejs

# Copy built application from builder stage
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/package*.json ./
COPY --from=builder --chown=appuser:nodejs /app/entrypoint.sh ./
COPY --from=builder --chown=appuser:nodejs /app/init.sql ./


# Install only production dependencies
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Create necessary directories with proper permissions and make scripts executable
RUN mkdir -p /app/logs && chown -R appuser:nodejs /app && chmod +x /app/entrypoint.sh

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the application with entrypoint script
ENTRYPOINT ["dumb-init", "--"]
CMD ["./entrypoint.sh"]