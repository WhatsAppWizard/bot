# Download Algorithm Flow Diagram

## High-Level System Flow

```
WhatsApp User Request
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        URL Processing                           │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Extract    │───▶│   Platform      │───▶│   Validate      │ │
│  │   URL from   │    │   Detection     │    │   Support       │ │
│  │   Message    │    │                 │    │                 │ │
│  └──────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Queue Management                          │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Create     │───▶│   Add to        │───▶│   Worker        │ │
│  │   Download   │    │   BullMQ        │    │   Processing    │ │
│  │   Job        │    │   Queue         │    │   (4 workers)   │ │
│  └──────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Platform-Specific Download                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────┐ │
│  │   TikTok     │  │  Instagram   │  │  Facebook    │  │ ... │ │
│  │              │  │              │  │              │  │     │ │
│  │  • 3 Retry   │  │  • SnapSaver │  │  • SnapSaver │  │     │ │
│  │  • nayan-api │  │  • Multi     │  │  • SD Res    │  │     │ │
│  │              │  │    Media     │  │    Priority  │  │     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────┘ │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    File Processing                             │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Download   │───▶│   File Type     │───▶│   Save to       │ │
│  │   to Buffer  │    │   Detection     │    │   Disk          │ │
│  │              │    │   (MIME)        │    │   (/platform/)  │ │
│  └──────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Response Delivery                          │
│                                                                 │
│  ┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Update     │───▶│   Send Media    │───▶│   Cleanup &     │ │
│  │   Status in  │    │   to WhatsApp   │    │   Analytics     │ │
│  │   Database   │    │   User          │    │                 │ │
│  └──────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Platform-Specific Processing Details

### TikTok Flow
```
TikTok URL
    │
    ▼
┌─────────────────┐
│  nayan-video-   │
│  downloader API │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Retry Logic    │
│  (3 attempts    │
│  with 2s delay) │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Direct Video   │
│  Download       │
└─────────────────┘
```

### Instagram/Facebook Flow
```
Instagram/Facebook URL
         │
         ▼
┌─────────────────┐
│  SnapSaver API  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Resolution     │
│  Processing     │
│  (SD Priority)  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Multi-Media    │
│  Download       │
│  (Images/Videos)│
└─────────────────┘
```

### YouTube Flow
```
YouTube URL
    │
    ▼
┌─────────────────┐
│  nayan-video-   │
│  downloader API │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Return Stream  │
│  URL (No local  │
│  download)      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Send URL to    │
│  User via       │
│  WhatsApp       │
└─────────────────┘
```

## Error Handling Flow

```
Download Request
       │
       ▼
┌─────────────────┐
│  Try Download   │
└─────────┬───────┘
          │
          ▼
      Success? ◄─────┐
      │        │    │
   Yes│        │No  │
      │        │    │
      ▼        ▼    │
┌───────────┐  ┌────────────┐
│  Deliver  │  │   Check    │
│  to User  │  │   Retry    │
└───────────┘  │   Count    │
               └─────┬──────┘
                     │
                     ▼
               ┌─────────────┐
               │  Retry      │
               │  Available? │
               └─────┬───────┘
                     │
              Yes────┘  No
                │       │
                │       ▼
                │  ┌─────────────┐
                │  │   Report    │
                │  │   Error     │
                │  │   to User   │
                │  └─────────────┘
                │
                └─▶ Wait & Retry
```

## Database Status Tracking

```
Job Creation
     │
     ▼
  PENDING
     │
     ▼
 DOWNLOADING
     │
     ├─▶ COMPLETED ─▶ Media Sent
     │
     └─▶ FAILED ────▶ Error Report
```

## Queue Management

```
New Download Request
         │
         ▼
┌─────────────────┐
│   Add to Queue  │
│   (BullMQ)      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Worker Pool   │
│   (4 workers)   │
│   Pick up job   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Process       │
│   Download      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│   Emit Events   │
│   (Completed/   │
│   Failed)       │
└─────────────────┘
```