import IORedis from "ioredis";
import { DownloadEvents, IDownloadJob, IDownloadJobResponse, IMessageData } from "../types/Download";
import QueueService from "./Queue";
import loggerService from "./Logger";

export interface IDownloadQueueListener {
  start(): Promise<void>;
  stop(): Promise<void>;
  isListening(): boolean;
}

export type StreamEventType =
  | "job_started"
  | "job_progress"
  | "job_completed"
  | "job_failed"
  | "worker_ready"
  | "worker_error";

export interface StreamEventPayload {
  jobId?: string;
  userId?: string;
  url?: string;
  stage?: string;
  progress?: number;
  detectedPlatform?: string | null;
  usedProvider?: string;
  downloadUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  details?: any;
  timestamp?: string;
  messageData?: IMessageData;
}

class DownloadQueueListener implements IDownloadQueueListener {
  private readonly redis: IORedis;
  private readonly queueService: QueueService;
  private isListeningToQueue: boolean = false;
  private consumerGroup: string = 'whatsapp-bot-group';
  private streamName: string = 'download-events'; // This should match your Config.getStreamConfig().name
  private consumerName: string = 'whatsapp-bot-consumer';
  private isConsuming: boolean = false;

  constructor() {
    this.redis = new IORedis(process.env.REDIS_URL || "", {
      maxRetriesPerRequest: null,
    });
    this.queueService = QueueService.getInstance();
  }

  async start(): Promise<void> {
    try {
      loggerService.info("Starting download queue listener with Redis Streams...");
      
      // Create consumer group if it doesn't exist
      await this.createConsumerGroup();
      
      // Start consuming from stream
      this.startStreamConsumption();

      this.isListeningToQueue = true;
      loggerService.info("Download queue listener started successfully");
    } catch (error) {
      loggerService.logError(error as Error, "DownloadQueueListener.start");
      throw error;
    }
  }

  private async createConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.streamName, this.consumerGroup, '$', 'MKSTREAM');
      loggerService.info(`Created consumer group: ${this.consumerGroup}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        loggerService.info(`Consumer group ${this.consumerGroup} already exists`);
      } else {
        throw error;
      }
    }
  }

  private startStreamConsumption(): void {
    this.isConsuming = true;
    
    const consumeLoop = async () => {
      while (this.isConsuming) {
        try {
          // Read from stream with consumer group
          const messages = await this.redis.xreadgroup(
            'GROUP', this.consumerGroup, this.consumerName,
            'COUNT', 10,
            'BLOCK', 1000, // Block for 1 second if no messages
            'STREAMS', this.streamName, '>'
          );

          if (messages && messages.length > 0) {
            const streamMessages = (messages[0] as any)[1]; // Get messages from first stream
            
            for (const [messageId, fields] of streamMessages) {
              await this.processStreamMessage(messageId, fields);
              
              // Acknowledge message processing
              await this.redis.xack(this.streamName, this.consumerGroup, messageId);
            }
          }
        } catch (error) {
          loggerService.logError(error as Error, "DownloadQueueListener.consumeLoop");
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };

    consumeLoop();
  }

  private async processStreamMessage(messageId: string, fields: string[]): Promise<void> {
    try {
      // Parse the stream message
      const event = this.parseStreamMessage(fields);
      
      loggerService.info("Received download event from stream", {
        messageId,
        eventType: event.event,
        jobId: event.jobId,
        userId: event.userId
      });

      // Process different event types
      switch (event.event) {
        case 'job_started':
          await this.handleJobStarted(event);
          break;
        case 'job_progress':
          await this.handleJobProgress(event);
          break;
        case 'job_completed':
          await this.handleJobCompleted(event);
          break;
        case 'job_failed':
          await this.handleJobFailed(event);
          break;
        case 'worker_ready':
          await this.handleWorkerReady(event);
          break;
        case 'worker_error':
          await this.handleWorkerError(event);
          break;
        default:
          loggerService.warn("Unknown event type received", { eventType: event.event });
      }
    } catch (error) {
      loggerService.logError(error as Error, "DownloadQueueListener.processStreamMessage", {
        messageId,
        fields
      });
    }
  }

  private parseStreamMessage(fields: string[]): { event: StreamEventType } & StreamEventPayload {
    const event: any = {};
    
    // Convert Redis stream fields array to object
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      
      // Parse JSON values
      if (key === 'details' || key === 'detectedPlatform' || key === 'messageData') {
        try {
          event[key] = JSON.parse(value);
        } catch {
          event[key] = value;
        }
      } else if (key === 'progress') {
        event[key] = parseInt(value);
      } else {
        event[key] = value;
      }
    }
    
    return event;
  }

  private async handleJobStarted(event: StreamEventPayload & { event: StreamEventType }): Promise<void> {
    loggerService.info("Download job started", {
      jobId: event.jobId,
      userId: event.userId,
      url: event.url,
      detectedPlatform: event.detectedPlatform,
      messageId: event.messageData?.id
    });
  }

  private async handleJobProgress(event: StreamEventPayload & { event: StreamEventType }): Promise<void> {
    if (event.jobId && event.progress !== undefined) {
      this.queueService.emitDownloadProgress(event.jobId, event.progress);
      
      loggerService.info("Download job progress", {
        jobId: event.jobId,
        progress: event.progress,
        stage: event.stage,
        messageId: event.messageData?.id
      });
    }
  }

  private async handleJobCompleted(event: StreamEventPayload & { event: StreamEventType }): Promise<void> {
    if (!event.jobId) return;

    // Emit stream event data directly
    this.queueService.emitStreamDownloadCompleted({
      jobId: event.jobId,
      userId: event.userId,
      url: event.url,
      downloadUrl: event.downloadUrl,
      detectedPlatform: event.detectedPlatform,
      usedProvider: event.usedProvider,
      messageData: event.messageData,
      timestamp: event.timestamp
    });
    
    loggerService.info("Download job completed", {
      jobId: event.jobId,
      userId: event.userId,
      messageId: event.messageData?.id,
      detectedPlatform: event.detectedPlatform,
      usedProvider: event.usedProvider,
      downloadUrl: event.downloadUrl
    });
  }

  private async handleJobFailed(event: StreamEventPayload & { event: StreamEventType }): Promise<void> {
    if (!event.jobId) return;

    // Emit stream event data directly
    this.queueService.emitStreamDownloadFailed({
      jobId: event.jobId,
      userId: event.userId,
      url: event.url,
      errorMessage: event.errorMessage,
      errorCode: event.errorCode,
      messageData: event.messageData,
      timestamp: event.timestamp
    });
    
    loggerService.info("Download job failed", {
      jobId: event.jobId,
      userId: event.userId,
      messageId: event.messageData?.id,
      errorCode: event.errorCode,
      errorMessage: event.errorMessage,
      details: event.details
    });
  }

  private async handleWorkerReady(event: StreamEventPayload & { event: StreamEventType }): Promise<void> {
    loggerService.info("Download worker is ready", {
      details: event.details
    });
  }

  private async handleWorkerError(event: StreamEventPayload & { event: StreamEventType }): Promise<void> {
    loggerService.logError(new Error(event.errorMessage || 'Worker error'), 'DownloadQueueListener.handleWorkerError', {
      errorCode: event.errorCode,
      details: event.details
    });
  }

  async stop(): Promise<void> {
    try {
      loggerService.info("Stopping download queue listener...");
      
      this.isConsuming = false;
      this.isListeningToQueue = false;
      
      await this.redis.quit();
      loggerService.info("Download queue listener stopped successfully");
    } catch (error) {
      loggerService.logError(error as Error, "DownloadQueueListener.stop");
      throw error;
    }
  }

  isListening(): boolean {
    return this.isListeningToQueue;
  }

  /**
   * Get stream statistics
   */
  async getStreamStats() {
    try {
      const info = await this.redis.xinfo('STREAM', this.streamName) as any[];
      return {
        length: info[1], // Number of messages in stream
        groups: info[7], // Number of consumer groups
        firstEntry: info[3], // First entry ID
        lastEntry: info[5] // Last entry ID
      };
    } catch (error) {
      loggerService.logError(error as Error, "DownloadQueueListener.getStreamStats");
      return null;
    }
  }
}

export default DownloadQueueListener;