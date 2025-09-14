# Use Node.js official image with Alpine for smaller size
FROM node:20-alpine AS base

# Install dependencies for Puppeteer and Chrome and PM2 in a single layer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus \
    xvfb \
    && rm -rf /var/cache/apk/* \
    && npm install -g pm2

# Tell Puppeteer to skip installing Chromium. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    DISPLAY=:99 \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    DBUS_SESSION_BUS_ADDRESS=/dev/null \
    # Logging configuration
    LOG_LEVEL=info \
    NODE_ENV=production \
    APP_VERSION=1.2.0

# Set working directory
WORKDIR /app

# Create app user for security and necessary directories in a single layer
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    mkdir -p /app/public/media /app/public/qrcodes /app/logs /app/BTAA /app/DEV /app/.wwebjs_cache /app/.wwebjs_auth && \
    chown -R nextjs:nodejs /app

# Create persistent storage volumes for auth data
VOLUME ["/app/BTAA", "/app/DEV", "/app/public/media", "/app/public/qrcodes","/app/.wwebjs_cache","/app/.wwebjs_auth"]

# Copy package files and prisma schema first for better caching
COPY package*.json ./ 
COPY prisma ./prisma/

# Install dependencies in a separate stage for better caching
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Development dependencies stage
FROM base AS build-deps
RUN npm ci

# Build stage
FROM build-deps AS build
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Generate Prisma client and build the application in a single layer
RUN npx prisma generate && \
    npm run build && \
    cp -R src/generated build/generated

# Production stage
FROM base AS production

# Copy all necessary files in a single layer
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/ecosystem.config.js ./
COPY package*.json ./

# Ensure proper ownership and permissions for the nextjs user
RUN mkdir -p /app/.wwebjs_cache /app/.wwebjs_auth && \
    chown -R nextjs:nodejs /app && \
    chmod -R 755 /app

# Copy entrypoint scrip

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { \
        res.statusCode === 200 ? process.exit(0) : process.exit(1) \
    }).on('error', () => process.exit(1))"

# Start the application with PM2
CMD ["pm2-runtime", "ecosystem.config.js"]