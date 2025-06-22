import axios from "axios";
import { fileTypeFromBuffer } from "file-type";
import { SnapSaver } from "snapsaver-downloader";
import { detectPlatformFromURL } from "snapsaver-downloader/dist/utils";
import { FacebookError } from "../errors/FacebookError";
import InstagramError from "../errors/InstagramError";
import { IDownloadedOnDisk } from "../types/Download";
import ConfigService from "./Config";
import FileService from "./Files";

class DownloadService {
  private async TikTokVideoDownloader(
    url: string
  ): Promise<IDownloadedOnDisk[]> {
    const tk = await this.TikTok(url);
    const file = await this.DownloadOnDisk(tk, "TikTok");
    return [file];
  }

  private async InstagramDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    return this.genericDownloader(url, "Instagram", InstagramError);
  }

  private async FacebookDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    return this.genericDownloader(url, "Facebook", FacebookError);
  }

  private async YouTubeDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    const yt = await this.Youtube(url);
    return [
      {
        path: yt,
        type: "video",
        platform: "YouTube",
      },
    ];
  }

  private async TwitterDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    const videoUrl = await this.Twitter(url);
    const file = await this.DownloadOnDisk(videoUrl, "Twitter");
    return [file];
  }

  private async Twitter(url: string): Promise<string> {
    const endpoint = `https://nayan-video-downloader.vercel.app/twitterdown?url=${encodeURIComponent(
      url
    )}`;
    const res = await axios.get(endpoint);

    if (res.status !== 200) {
      throw new Error("Failed to fetch video URL.");
    }
    const videoUrl: string = res.data.data.SD || res.data.data.HD;
    if (!videoUrl) {
      throw new Error(
        "No video URL found in the response. Both SD and HD are undefined."
      );
    }

    return videoUrl;
  }

  private async Youtube(url: string): Promise<string> {
    const endpoint = `https://nayan-video-downloader.vercel.app/ytdown?url=${encodeURIComponent(
      url
    )}`;
    const res = await axios.get(endpoint);

    if (res.status !== 200) {
      throw new Error("Failed to fetch video URL.");
    }
    const videoUrl = res.data.data.video;

    return videoUrl;
  }

  private async TikTok(url: string): Promise<string> {
    const endpoint = `https://nayan-video-downloader.vercel.app/tikdown?url=${encodeURIComponent(
      url
    )}`;
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await axios.get(endpoint);
        if (res.status !== 200 || !res.data.data.video) {
          throw new Error("Failed to fetch video URL.");
        }
        return res.data.data.video;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          
          console.warn(
            `Attempt ${attempt} failed. Retrying... Error: ${error}`
          );
          
          // Set a delay before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
          
          continue;
        }
      }
    }
    throw lastError ?? new Error("Failed to fetch video URL after 3 attempts.");
  }

  private detectPlatform(url: string): string {
    const platform = detectPlatformFromURL(url);

    if (!platform) {
      throw new Error("Invalid URL or unsupported platform.");
    }
    return platform;
  }

  public async Download(url: string): Promise<IDownloadedOnDisk[]> {
    // 1. Detect the platform of url

    const platform = this.detectPlatform(url);
    // 2. Call the appropriate downloader based on the platform
    let downloader: (url: string) => Promise<IDownloadedOnDisk[]>;
    switch (platform) {
      case "TikTok":
        downloader = this.TikTokVideoDownloader.bind(this);
        break;
      case "Instagram":
        downloader = this.InstagramDownloader.bind(this);
        break;
      case "Facebook":
        downloader = this.FacebookDownloader.bind(this);
        break;
      case "YouTube":
        downloader = this.YouTubeDownloader.bind(this);
        break;
      case "Twitter":
        downloader = this.TwitterDownloader.bind(this);
        break;
      default:
        throw new Error("Unsupported platform.");
    }
    // 3. Call the downloader and return the result
    try {
      const result = await downloader(url);
      return result;
    } catch (error) {
      console.error("Download error:", error);
      throw error;
    }
  }

  private async DownloadOnDisk(
    url: string,
    platform: string
  ): Promise<IDownloadedOnDisk> {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(res.data);
    const fileType = await fileTypeFromBuffer(buffer);

    const DownloadPath = ConfigService.getDownloadPaths(platform);
    const timestamp = Date.now();

    let extension = fileType?.ext ?? "bin";
    let mime = fileType?.mime ?? "";

    let type: "video" | "image";

    if (mime.startsWith("image/")) {
      type = "image";
    } else if (mime.startsWith("video/")) {
      type = "video";
    } else {
      throw new Error(`Unsupported MIME type: ${mime}`);
    }

    const fileName = `${timestamp}.${extension}`;
    const filePath = `${DownloadPath}/${fileName}`;
    await FileService.saveFile(filePath, buffer);
    return { path: filePath, type, platform };
  }

  private async genericDownloader(
    url: string,
    platform: "Instagram" | "Facebook",
    errorClass: any
  ): Promise<IDownloadedOnDisk[]> {
    try {
      const result = await SnapSaver(url);
      if (!result.success)
        throw new errorClass(result.message ?? "Unknown error");
      // Facebook is the only one that returns a different structure as Resolution,
      // we need pick the SD resolution since we are targeting the mobile version
      if (platform === "Facebook") {
        if (!result.data) throw new errorClass("No data found");

        let SDResolution;
        if (result.data?.media) {
          SDResolution = result.data.media.filter((item: any) =>
            item.resolution?.includes("SD")
          )[0];
        }
        let mediaArr: any[];
        if (SDResolution) {
          mediaArr = [SDResolution];
        } else if (result.data.media) {
          mediaArr = [result.data.media[result.data.media.length - 1]];
        } else {
          mediaArr = [];
        }
        result.data.media = mediaArr;
      }
      const mediaUrls = (result.data?.media || [])
        .map((item) => item.url)
        .filter((url): url is string => Boolean(url));

      const SavedFiles: IDownloadedOnDisk[] = [];

      for (const mediaUrl of mediaUrls) {
        const path = await this.DownloadOnDisk(mediaUrl, platform);
        if (!path) throw new errorClass("Failed to download media");
        SavedFiles.push(path);
      }

      return SavedFiles;
    } catch (error) {
      console.error(`${platform} Download error:`, error);
      throw error;
    }
  }
}

export const downloadService = new DownloadService();
