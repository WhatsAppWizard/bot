# Use Node.js official image with Alpine for smaller size
FROM node:20-alpine AS base

# Install dependencies for Puppeteer and Chrome
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
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to skip installing Chromium. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    DISPLAY=:99 \
    CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    DBUS_SESSION_BUS_ADDRESS=/dev/null

# Set working directory
WORKDIR /app

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy package files
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

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Include Prisma client output in build folder for production runtime
RUN cp -R src/generated build/generated

# Debug: Check what was built
RUN echo "Contents of /app:" && ls -la /app/
RUN echo "Contents of /app/build:" && ls -la /app/build/
RUN echo "Contents of /app/build/generated:" && ls -la /app/build/generated/ || echo "No generated folder"
RUN echo "Checking index.js:" && test -f /app/build/index.js && echo "index.js exists" || echo "index.js NOT found"

# Production stage
FROM base AS production

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

# Debug: Verify files were copied correctly
RUN echo "Production stage - Contents of /app:" && ls -la /app/
RUN echo "Production stage - Contents of /app/build:" && ls -la /app/build/
RUN echo "Production stage - Contents of /app/build/generated:" && ls -la /app/build/generated/ || echo "No generated folder"
RUN echo "Production stage - Checking index.js:" && test -f /app/build/index.js && echo "index.js exists" || echo "index.js NOT found"

# Create necessary directories with proper permissions
RUN mkdir -p /app/public/media /app/public/qrcodes /app/logs /app/BTA /app/DEV && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { \
        res.statusCode === 200 ? process.exit(0) : process.exit(1) \
    }).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "/app/build/index.js"]