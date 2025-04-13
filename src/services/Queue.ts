import { Queue, Worker } from "bullmq";

import { EventEmitter } from "events";
import IORedis from "ioredis";

class QueueService extends EventEmitter {
  private redis: IORedis;

  private DownloaderQueue!: Queue;
  private DownloaderWorker!: Worker;

  
  private static instance: QueueService;

  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
      QueueService.instance.RegisterListeners();
      
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
    this.DownloaderQueue = new Queue("whatsapp-bot-downloader-queue", {
      connection: this.redis,
    });
    this.DownloaderWorker = new Worker(
      "whatsapp-bot-downloader-queue",
      async (job) => {
        console.log(job.data);
      },
      {
        connection: this.redis,
        concurrency: 1,
      }
    );
  }


  public async addJobToDownloaderQueue(name: string, job: any) {
    await this.DownloaderQueue.add(name, job);
  }

  public async getDownloaderQueueCount(): Promise<number> {
    return await this.DownloaderQueue.count();
  }

  private RegisterListeners() {
    // this.StickersWorker.on("completed", (jobId, result) => {
    //   console.log(`Job ${jobId} completed with result:`, result);
    //   this.emit('stickersJobCompleted', { jobId, result });
    // });
    // this.StickersWorker.on("failed", (jobId, error) => {
    //   console.log(`Job ${jobId} failed with error ${error}`);
    // });
    // this.StickersWorker.on("progress", (jobId, progress) => {
    //   console.log(`Job ${jobId} progress ${progress}`);
    // });
  }
}

export default QueueService;
