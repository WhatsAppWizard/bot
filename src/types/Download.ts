import { Job } from "bullmq";
import { Message } from "whatsapp-web.js";

export interface IDownloadedOnDisk {
    path: string;
    type: "video" | "image";
    platform: string;
  }

export enum DownloadEvents { 
    DownloadCompleted = "downloadCompleted",
    DownloadFailed = "downloadFailed",
    DownloadProgress = "downloadProgress",
}

export interface IDownloadJob {
  url: string;
  message: Message;
  downloadId: string;
}

export interface IDownloadJobResponse {
  download: IDownloadedOnDisk[];
  downloadId: string;
}

export type DownloadJob = Job<IDownloadJob, IDownloadJobResponse>;