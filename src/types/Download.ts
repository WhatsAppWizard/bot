import { Job } from "bullmq";

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

export interface IMessageData {
  id: string;
  from: string;
  to?: string;
  timestamp: number;
  body?: string;
  type: string;
  isGroup: boolean;
  isForwarded: boolean;
  fromMe: boolean;
  hasMedia: boolean;
  hasQuotedMsg: boolean;
}

export interface IDownloadJob {
  url: string;
  messageData: IMessageData;
  downloadId: string;
  userId: string;
  userNumber: string;
  timestamp: number;
}

export interface IDownloadJobResponse {
  download: IDownloadedOnDisk[];
  downloadId: string;
}

export type DownloadJob = Job<IDownloadJob, IDownloadJobResponse>;