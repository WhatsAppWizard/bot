import { Queue, Worker, } from "bullmq";

import { EventEmitter } from "events";
import IORedis from "ioredis";
import { DownloadStatus } from "../generated/prisma";
import { DownloadEvents, DownloadJob, IDownloadJob, IDownloadJobResponse } from "../types/Download";
import DownloadRepository from "./Database/Downloads";
import { downloadService } from "./Download";

class QueueService extends EventEmitter {
  private readonly redis: IORedis;
  

  private downloaderQueue!: Queue;
  private downloaderWorker!: Worker;

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
    this.queueEvents();

  }

  private setupDownloaderQueue() {
    this.downloaderQueue = new Queue<IDownloadJob, IDownloadJobResponse>("whatsapp-bot-downloader-queue", {
      connection: this.redis,
    });
    this.downloaderWorker = new Worker<IDownloadJob, IDownloadJobResponse>(
      "whatsapp-bot-downloader-queue",
      async (job) => {
        const DownloadRepo = new DownloadRepository();

        try  {
        const { data } = job;
        const { url,  downloadId } = data;

        await DownloadRepo.updateStatusById(downloadId, DownloadStatus.DOWNLOADING);
        const download = await downloadService.Download(url);

        if (!download) {
          await DownloadRepo.updateStatusById(downloadId, DownloadStatus.FAILED);
         throw new Error("Download failed, No DownloadLinks Returned");
        }
        

        await DownloadRepo.updateDownloadById(downloadId, {
          status: DownloadStatus.COMPLETED,
          platform: download[0].platform,
          
        });


        return {
          download,
          downloadId,
        };
        } catch (error) {
          await DownloadRepo.updateStatusById(job.data.downloadId, DownloadStatus.FAILED);

          console.error("Error in downloader worker:", error);
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: 4,
        removeOnComplete: {
          age: 60 * 60 * 24, // Remove completed jobs after 24 hours
          count: 100, // Keep the last 100 completed jobs
        },
        removeOnFail: {
          age: 60 * 60 * 24, // Remove failed jobs after 24 hours
          count: 100, // Keep the last 100 failed jobs
        },

      }
    );
  }

  public async addJobToDownloaderQueue(name: string, job: IDownloadJob) {
    await this.downloaderQueue.add(name, job);
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

  private queueEvents() {
    this.downloaderWorker.on("completed", (job) => {

      console.log("Emitting download completed event", job.id, job.data.downloadId);

      this.emit(DownloadEvents.DownloadCompleted, job as DownloadJob);
    });
    this.downloaderWorker.on("failed", (job, error) => {
      this.emit(DownloadEvents.DownloadFailed, job, error);
    });
    this.downloaderWorker.on("progress", (jobId, progress) => {
      this.emit(DownloadEvents.DownloadProgress, { jobId, progress });
    });
  }

  public async getLastSuccessfulDownload(): Promise<any | null> {
    const jobs = await this.downloaderQueue.getJobs(["completed"], 0, -1, true);
    if (jobs.length === 0) return null;
    return jobs[jobs.length - 1];
  }
}

export default QueueService;
