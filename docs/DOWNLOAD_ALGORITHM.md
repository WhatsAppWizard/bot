# Download Algorithm Documentation

## Overview

The WhatsAppWizard bot implements a sophisticated multi-platform download system that allows users to download media content from popular social media platforms directly through WhatsApp. The system is designed with scalability, reliability, and platform flexibility in mind.

## Supported Platforms

- **TikTok** - Video downloads
- **Instagram** - Photos and videos
- **Facebook** - Photos and videos  
- **YouTube** - Video downloads (returns direct URL)
- **Twitter** - Photos and videos

## Architecture Components

### 1. DownloadService (`src/services/Download.ts`)
The core service responsible for orchestrating the download process across different platforms.

### 2. QueueService (`src/services/Queue.ts`)
Manages asynchronous job processing using BullMQ with Redis backend for scalability.

### 3. Platform-Specific Downloaders
Each platform has its own implementation optimized for that platform's API and content structure.

### 4. File Management System
Handles file storage, organization, and metadata management on disk.

## Algorithm Flow

For detailed visual flow diagrams, see: **[📊 Download Flow Diagrams](DOWNLOAD_FLOW_DIAGRAM.md)**

```
┌─────────────────┐
│   User sends    │
│   URL via       │
│   WhatsApp      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  URL Validation │
│  & Platform     │
│  Detection      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Job Queue     │
│   Creation      │
│   (BullMQ)      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Platform-      │
│  Specific       │
│  Download       │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  File Storage   │
│  & Metadata     │
│  Processing     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Response      │
│   to User       │
│   via WhatsApp  │
└─────────────────┘
```

## Detailed Process Breakdown

### Phase 1: URL Processing and Platform Detection

1. **URL Reception**: User sends a URL through WhatsApp
2. **Platform Detection**: Uses `detectPlatformFromURL()` from snapsaver-downloader
3. **Validation**: Ensures the URL is from a supported platform
4. **Job Creation**: Creates a download job with unique ID

```typescript
const platform = this.detectPlatform(url);
if (!platform) {
  throw new Error("Invalid URL or unsupported platform.");
}
```

### Phase 2: Queue Management

The system uses BullMQ for robust job processing:

- **Concurrency**: 4 concurrent workers
- **Job Persistence**: Redis-backed storage
- **Status Tracking**: PENDING → DOWNLOADING → COMPLETED/FAILED
- **Cleanup**: Automatic removal of old jobs (24 hours)

```typescript
this.downloaderWorker = new Worker(
  "whatsapp-bot-downloader-queue",
  async (job) => {
    // Download processing logic
  },
  {
    connection: this.redis,
    concurrency: 4,
    removeOnComplete: {
      age: 60 * 60 * 24, // 24 hours
      count: 100,        // Keep last 100 jobs
    }
  }
);
```

### Phase 3: Platform-Specific Download Strategies

#### TikTok Downloads
- **API**: nayan-video-downloader
- **Retry Logic**: 3 attempts with 2-second delays
- **Content**: Direct video downloads

```typescript
private async TikTok(url: string): Promise<string> {
  const endpoint = `https://nayan-video-downloader.vercel.app/tikdown?url=${encodeURIComponent(url)}`;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await axios.get(endpoint);
      return res.data.data.video;
    } catch (error) {
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}
```

#### Instagram & Facebook Downloads
- **API**: SnapSaver downloader
- **Resolution Handling**: Prioritizes SD resolution for mobile compatibility
- **Content**: Supports both images and videos

```typescript
private async genericDownloader(
  url: string,
  platform: "Instagram" | "Facebook",
  errorClass: any
): Promise<IDownloadedOnDisk[]> {
  const result = await SnapSaver(url);
  
  // Facebook-specific resolution handling
  if (platform === "Facebook") {
    const SDResolution = result.data.media.filter(
      item => item.resolution?.includes("SD")
    )[0];
    // Use SD resolution or fallback to last available
  }
}
```

#### YouTube Downloads
- **API**: nayan-video-downloader
- **Special Handling**: Returns URL instead of direct download
- **Content**: Video URLs for streaming

#### Twitter Downloads
- **API**: nayan-video-downloader  
- **Quality**: Supports both SD and HD with fallback
- **Content**: Photos and videos

### Phase 4: File Storage and Management

1. **Download to Memory**: Content is first downloaded to buffer
2. **File Type Detection**: Uses `file-type` library for MIME type detection
3. **File Organization**: Platform-specific folder structure
4. **Naming Convention**: Timestamp-based unique filenames

```typescript
private async DownloadOnDisk(
  url: string,
  platform: string
): Promise<IDownloadedOnDisk> {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(res.data);
  const fileType = await fileTypeFromBuffer(buffer);
  
  const DownloadPath = ConfigService.getDownloadPaths(platform);
  const timestamp = Date.now();
  const fileName = `${timestamp}.${fileType?.ext ?? "bin"}`;
  const filePath = `${DownloadPath}/${fileName}`;
  
  await FileService.saveFile(filePath, buffer);
  return { path: filePath, type: mediaType, platform };
}
```

### File Organization Structure
```
public/
└── media/
    ├── TikTok/
    ├── Instagram/
    ├── Facebook/
    ├── YouTube/
    └── Twitter/
```

## Error Handling and Resilience

### Retry Mechanisms
- **TikTok**: 3 attempts with exponential backoff
- **Network Failures**: Automatic retry for transient errors
- **Platform-Specific Errors**: Custom error classes for each platform

### Status Tracking
- **Database Integration**: Prisma ORM for status persistence
- **Real-time Updates**: Status changes are tracked throughout the process
- **Error Logging**: Comprehensive error reporting and analytics

### Error Types
```typescript
// Platform-specific error classes
- InstagramError
- FacebookError  
- Generic network errors
- File system errors
```

## Performance Optimizations

### Concurrency Management
- **Worker Concurrency**: 4 simultaneous downloads
- **Queue Prioritization**: FIFO job processing
- **Resource Management**: Automatic cleanup of completed jobs

### Memory Management
- **Streaming Downloads**: Large files handled via streams
- **Buffer Management**: Efficient memory usage for file processing
- **Cleanup**: Automatic removal of temporary files

### Caching Strategy
- **Redis Integration**: Job state persistence
- **File Deduplication**: Prevents redundant downloads
- **Metadata Caching**: Platform detection results

## Monitoring and Analytics

### Event System
```typescript
export enum DownloadEvents {
  DownloadCompleted = "downloadCompleted",
  DownloadFailed = "downloadFailed", 
  DownloadProgress = "downloadProgress"
}
```

### Metrics Tracking
- **Success/Failure Rates**: Per platform statistics
- **Performance Metrics**: Download times and throughput
- **Error Analytics**: PostHog integration for error tracking

### Queue Monitoring
```typescript
public async getDownloaderQueueCount(): Promise<any> {
  return {
    waiting: await this.downloaderQueue.getWaitingCount(),
    active: await this.downloaderQueue.getActiveCount(),
    completed: await this.downloaderQueue.getCompletedCount(),
    failed: await this.downloaderQueue.getFailedCount(),
    delayed: await this.downloaderQueue.getDelayedCount(),
    lastSuccessfulDownload: await this.getLastSuccessfulDownload()
  }
}
```

## Integration with WhatsApp

### Message Processing
1. **URL Detection**: Automatic link extraction from messages
2. **User Feedback**: Real-time status updates via WhatsApp
3. **Media Delivery**: Direct file sending or URL sharing (YouTube)
4. **Error Communication**: User-friendly error messages

### Rate Limiting
- **Per-user Limits**: Prevents abuse
- **Platform Limits**: Respects external API constraints
- **Queue Management**: Graceful handling of high load

## Security Considerations

### Input Validation
- **URL Sanitization**: Prevents malicious URL injection
- **Platform Verification**: Ensures URLs are from supported platforms
- **File Type Validation**: MIME type verification before storage

### Resource Protection
- **File Size Limits**: Prevents storage exhaustion
- **Download Timeouts**: Prevents hanging operations
- **Access Control**: Secure file storage and retrieval

## Future Enhancements

### Planned Improvements
- [ ] Additional platform support (Pinterest, Reddit, etc.)
- [ ] Advanced file compression
- [ ] CDN integration for faster delivery
- [ ] Enhanced analytics and reporting
- [ ] API rate limiting improvements

### Scalability Considerations
- **Horizontal Scaling**: Multiple worker instances
- **Database Optimization**: Enhanced query performance
- **Caching Layer**: Redis-based content caching
- **Load Balancing**: Request distribution across workers

## Troubleshooting

### Common Issues
1. **Platform API Changes**: Regular monitoring and updates required
2. **Network Timeouts**: Retry mechanisms handle transient failures
3. **Storage Issues**: Automatic cleanup and monitoring
4. **Queue Overload**: Graceful degradation and user notification

### Debugging Tools
- **Comprehensive Logging**: All operations are logged
- **Queue Inspection**: Real-time queue status monitoring  
- **Error Tracking**: PostHog integration for error analytics
- **Performance Metrics**: Download time and success rate tracking

---

This download algorithm provides a robust, scalable solution for multi-platform media downloading through WhatsApp, with comprehensive error handling, monitoring, and user experience optimization.