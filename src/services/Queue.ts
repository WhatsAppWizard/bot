import { Job, Queue, Worker } from "bullmq";

import { EventEmitter } from "events";
import IORedis from "ioredis";
import { DownloadEvents, DownloadJob, IDownloadJob, IDownloadJobResponse } from "../types/Download";
import DownloadRepository from "./Database/Downloads";
import { downloadService } from "./Download";

class QueueService extends EventEmitter {
  private redis: IORedis;

  private DownloaderQueue!: Queue;
  private DownloaderWorker!: Worker;

  private static instance: QueueService;

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
      QueueService.instance.queueEvents();
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
    this.DownloaderQueue = new Queue<IDownloadJob, IDownloadJobResponse>("whatsapp-bot-downloader-queue", {
      connection: this.redis,
    });
    this.DownloaderWorker = new Worker<IDownloadJob, IDownloadJobResponse>(
      "whatsapp-bot-downloader-queue",
      async (job) => {
        const DownloadRepo = new DownloadRepository();
        const { data } = job;
        const { url, userId, timestamp } = data;

        const download = await downloadService.Download(url);
        const DownloadInDatabase = await DownloadRepo.create(
          url,
          download[0].platform,
          userId,
          timestamp
        );

        return {
          download,
          downloadId: DownloadInDatabase.id,
        };
      },
      {
        connection: this.redis,
        concurrency: 1,
      }
    );
  }

  public async addJobToDownloaderQueue(name: string, job: IDownloadJob) {
    await this.DownloaderQueue.add(name, job);
  }

  public async getDownloaderQueueCount(): Promise<number> {
    return await this.DownloaderQueue.count();
  }

  private queueEvents() {
    this.DownloaderWorker.on("completed", (job) => {

      this.emit(DownloadEvents.DownloadCompleted, job as DownloadJob);
    });
    this.DownloaderWorker.on("failed", (jobId, error) => {
      this.emit(DownloadEvents.DownloadFailed, { jobId, error });
    });
    this.DownloaderWorker.on("progress", (jobId, progress) => {
      this.emit(DownloadEvents.DownloadProgress, { jobId, progress });
    });
  }
}

export default QueueService;
