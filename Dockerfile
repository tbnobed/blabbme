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

# Build the frontend first
RUN npx vite build --outDir dist/public

# Verify frontend build
RUN ls -la dist/public/ && echo "Frontend build contents:" && find dist/public -type f | head -10

# Build the server
RUN node build-server.js

# Verify complete build
RUN echo "Complete dist contents:" && ls -la dist/

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

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/ || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]