import { Queue } from "bullmq";
import { EventEmitter } from "events";
import IORedis from "ioredis";
import { DownloadEvents, IDownloadJob, IDownloadJobResponse, IMessageData } from "../types/Download";

class QueueService extends EventEmitter {
  private readonly redis: IORedis;
  private downloaderQueue!: Queue;

  private static instance: QueueService;

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }

  private constructor() {
    super();
    this.redis = new IORedis(process.env.REDIS_URL || "", {
      maxRetriesPerRequest: null,
    });
    this.setupDownloaderQueue();
  }

  private setupDownloaderQueue() {
    this.downloaderQueue = new Queue<IDownloadJob, IDownloadJobResponse>("download-queue", {
      connection: this.redis,
    });
  }

  public async addJobToDownloaderQueue(job: IDownloadJob, options?: {
    priority?: number;
    delay?: number;
  }) {
    await this.downloaderQueue.add("download-file", job, {
      priority: options?.priority || 0,
      delay: options?.delay || 0,
    });
  }

  public async getDownloaderQueueCount(): Promise<any> {
    return {
      waiting: await this.downloaderQueue.getWaitingCount(),
      active: await this.downloaderQueue.getActiveCount(),
      completed: await this.downloaderQueue.getCompletedCount(),
      failed: await this.downloaderQueue.getFailedCount(),
      delayed: await this.downloaderQueue.getDelayedCount(),
      // Last successful download
      lastSuccessfulDownload: await this.getLastSuccessfulDownload(),
    }
  }

  // Stream event methods
  public emitStreamDownloadCompleted(eventData: {
    jobId: string;
    userId?: string;
    url?: string;
    downloadUrl?: string;
    detectedPlatform?: string | null;
    usedProvider?: string;
    messageData?: IMessageData;
    timestamp?: string;
  }): void {
    console.log("Emitting stream download completed event", eventData.jobId);
    this.emit(DownloadEvents.DownloadCompleted, eventData);
  }

  public emitStreamDownloadFailed(eventData: {
    jobId: string;
    userId?: string;
    url?: string;
    errorMessage?: string;
    errorCode?: string;
    messageData?: IMessageData;
    timestamp?: string;
  }): void {
    console.log("Emitting stream download failed event", eventData.jobId);
    this.emit(DownloadEvents.DownloadFailed, eventData);
  }

  public emitDownloadProgress(jobId: string, progress: number): void {
    this.emit(DownloadEvents.DownloadProgress, { jobId, progress });
  }

  public async getLastSuccessfulDownload(): Promise<any | null> {
    const jobs = await this.downloaderQueue.getJobs(["completed"], 0, -1, true);
    if (jobs.length === 0) return null;
    return jobs[jobs.length - 1];
  }

  /**
   * Get job status by ID (similar to external download service)
   */
  public async getJobStatus(jobId: string) {
    const job = await this.downloaderQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      data: job.data,
      state: await job.getState(),
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  }

  /**
   * Clean up completed and failed jobs
   */
  public async cleanQueue(grace: number = 5000) {
    await this.downloaderQueue.clean(grace, 10, "completed");
    await this.downloaderQueue.clean(grace, 5, "failed");
    console.log("🧹 Cleaned up old jobs from queue");
  }
}

export default QueueService;