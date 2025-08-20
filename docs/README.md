# Documentation

Welcome to the WhatsAppWizard documentation! This directory contains detailed technical documentation for various aspects of the system.

## Available Documentation

### 📥 [Download Algorithm](DOWNLOAD_ALGORITHM.md)
Comprehensive technical documentation explaining the multi-platform download system, including:
- Architecture overview and components
- Platform-specific download strategies
- Error handling and retry mechanisms  
- Performance optimizations
- Monitoring and analytics
- Security considerations

### 📊 [Download Flow Diagrams](DOWNLOAD_FLOW_DIAGRAM.md)
Visual flow diagrams showing:
- High-level system flow
- Platform-specific processing flows
- Error handling flow
- Database status tracking
- Queue management

## Quick Reference

### Supported Platforms
- **TikTok** - Video downloads with 3-retry logic
- **Instagram** - Photos and videos via SnapSaver
- **Facebook** - Photos and videos with SD resolution priority
- **YouTube** - Video URL streaming (no local download)
- **Twitter** - Photos and videos with SD/HD fallback

### Key Technologies
- **BullMQ** - Job queue management
- **Redis** - Queue persistence and caching
- **Prisma** - Database ORM
- **WhatsApp Web.js** - WhatsApp integration
- **SnapSaver** - Instagram/Facebook API
- **nayan-video-downloader** - TikTok/YouTube/Twitter API

### Performance Characteristics
- **Concurrency**: 4 simultaneous download workers
- **Queue Cleanup**: 24-hour retention policy
- **Retry Logic**: Platform-specific retry mechanisms
- **File Organization**: Platform-based folder structure

---

For general setup and usage information, see the main [README.md](../README.md).