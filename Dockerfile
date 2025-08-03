# Use Node.js slim base image for better multi-arch support
FROM node:20-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    DISPLAY=:99 \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    DBUS_SESSION_BUS_ADDRESS=/dev/null

# Install Chromium, PM2, and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    dbus \
    fonts-freefont-ttf \
    ca-certificates \
    && npm install -g pm2 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create app user and folders
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nextjs && \
    mkdir -p /app/public/media /app/public/qrcodes /app/logs /app/BTA /app/DEV && \
    chown -R nextjs:nodejs /app

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install production deps
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS build-deps
RUN npm ci
COPY . .
COPY --from=deps /app/node_modules ./node_modules
RUN npx prisma generate && npm run build && cp -R src/generated build/generated

# Final image
FROM base AS production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build-deps /app/build ./build
COPY --from=build-deps /app/prisma ./prisma
COPY --from=build-deps /app/ecosystem.config.js ./
COPY package*.json ./
USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { \
    res.statusCode === 200 ? process.exit(0) : process.exit(1) \
  }).on('error', () => process.exit(1))"

CMD ["pm2-runtime", "ecosystem.config.js"]
