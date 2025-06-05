# Docker Setup for WhatsApp Wizard

This document provides comprehensive instructions for running WhatsApp Wizard using Docker, following best practices for containerization.

## 🐳 Docker Architecture

The application uses a multi-stage Docker build with the following services:

- **WhatsApp Wizard App**: Node.js/TypeScript application with Puppeteer
- **PostgreSQL**: Database for storing users, downloads, and stickers
- **Redis**: Message queue and caching
- **pgAdmin** (optional): Database management interface
- **Redis Commander** (optional): Redis management interface

## 📋 Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- At least 2GB of available RAM
- Telegram Bot Token and Chat ID (required for admin notifications)

## 🚀 Quick Start

### 1. Environment Setup

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` and provide the required values:

```env
# Required - Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here
CHAT_ID=your_telegram_chat_id_here

# Database (can use defaults)
POSTGRES_DB=whatsappwizard
POSTGRES_USER=postgres
POSTGRES_PASSWORD=whatsapp123

# Optional - Analytics
POSTHOG_API_KEY=your_posthog_key
POSTHOG_HOST=https://app.posthog.com
```

### 2. Production Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f whatsapp-wizard

# Check health status
docker-compose ps
```

### 3. Development Mode

For development with hot reload:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f whatsapp-wizard-dev
```

### 4. Initialize Database

On first run, initialize the database:

```bash
# Run Prisma migrations
docker-compose exec whatsapp-wizard npx prisma migrate deploy

# Optional: Seed data
docker-compose exec whatsapp-wizard npx prisma db seed
```

## 📊 Service URLs

- **WhatsApp Wizard API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **pgAdmin** (dev): http://localhost:8080
- **Redis Commander** (dev): http://localhost:8081

## 💾 Data Persistence

The following data is persisted using Docker volumes:

- **PostgreSQL Data**: `postgres_data`
- **Redis Data**: `redis_data`
- **WhatsApp Sessions**: `whatsapp_sessions` (BTA), `whatsapp_dev_sessions` (DEV)
- **Media Files**: `whatsapp_media` (public/media, public/qrcodes)
- **Application Logs**: `whatsapp_logs`

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | ✅ | - | Telegram bot token for admin notifications |
| `CHAT_ID` | ✅ | - | Telegram chat ID for admin notifications |
| `DATABASE_URL` | ✅ | Auto-generated | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Auto-generated | Redis connection string |
| `NODE_ENV` | ❌ | production | Application environment |
| `PORT` | ❌ | 3000 | Application port |
| `POSTHOG_API_KEY` | ❌ | - | PostHog analytics API key |
| `POSTHOG_HOST` | ❌ | - | PostHog host URL |

### Puppeteer Configuration

The container is pre-configured with:
- Chromium browser installed
- Optimal flags for containerized environment
- No sandbox mode for Docker compatibility

## 🛠️ Management Commands

### Container Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart a specific service
docker-compose restart whatsapp-wizard

# View service logs
docker-compose logs -f [service-name]

# Scale services (if needed)
docker-compose up -d --scale whatsapp-wizard=2
```

### Database Management

```bash
# Run Prisma commands
docker-compose exec whatsapp-wizard npx prisma [command]

# Database migrations
docker-compose exec whatsapp-wizard npx prisma migrate deploy

# Generate Prisma client
docker-compose exec whatsapp-wizard npx prisma generate

# Prisma Studio (database browser)
docker-compose exec whatsapp-wizard npx prisma studio
```

### Backup and Restore

```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U postgres whatsappwizard > backup.sql

# Restore PostgreSQL
docker-compose exec -T postgres psql -U postgres whatsappwizard < backup.sql

# Backup volumes
docker run --rm -v whatsapp_sessions:/data -v $(pwd):/backup busybox tar czf /backup/sessions-backup.tar.gz /data
```

## 🔍 Troubleshooting

### Common Issues

1. **Puppeteer/Chrome Issues**
   ```bash
   # Check if Chromium is available
   docker-compose exec whatsapp-wizard /usr/bin/chromium-browser --version
   ```

2. **Permission Issues**
   ```bash
   # Fix volume permissions
   docker-compose exec whatsapp-wizard chown -R nextjs:nodejs /app
   ```

3. **Database Connection Issues**
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U postgres
   ```

### Health Checks

The application includes built-in health checks:

```bash
# Check application health
curl http://localhost:3000/api/health

# Check all service status
docker-compose ps
```

### Log Analysis

```bash
# Application logs
docker-compose logs whatsapp-wizard

# Database logs
docker-compose logs postgres

# Redis logs
docker-compose logs redis

# All logs with timestamps
docker-compose logs -t
```

## 🚨 Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **Network Security**: Services communicate via internal Docker network
3. **User Permissions**: Application runs as non-root user (`nextjs`)
4. **Volume Security**: Sensitive data is stored in named volumes
5. **Database Security**: Use strong passwords in production

## 📈 Monitoring

### Health Endpoints

- **Application**: `GET /api/health`
- **Returns**: Service status, WhatsApp connection, queue status

### Logs

Application logs are stored in the `whatsapp_logs` volume and can be accessed via:

```bash
docker-compose exec whatsapp-wizard tail -f /app/logs/out.log
docker-compose exec whatsapp-wizard tail -f /app/logs/error.log
```

## 🔄 Updates

To update the application:

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Run any new migrations
docker-compose exec whatsapp-wizard npx prisma migrate deploy
```

## 📝 Notes

- WhatsApp session data is automatically persisted between container restarts
- The first startup requires QR code scanning (check Telegram notifications)
- Development mode includes pgAdmin and Redis Commander for debugging
- Production mode excludes development tools for security

For more information, visit the [main README](./README.md) file.
