import ConfigService from "./Config";
import { detectPlatformFromURL } from "../SnapSaver/utils";
import { FacebookError } from "../errors/FacebookError";
import FileService from "./Files";
import { IDownloadedOnDisk } from "../types/Download";
import InstagramError from "../errors/InstagramError";
import { SnapSaver } from "../SnapSaver/Download";
import TikTokError from "../errors/TikTokError";
import axios from "axios";

class DownloadService {
  constructor() {}
  private async TikTokVideoDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    return this.genericDownloader(url, "TikTok", TikTokError);
  }
  
  private async InstagramDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    return this.genericDownloader(url, "Instagram", InstagramError);
  }

  private async FacebookDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    return this.genericDownloader(url, "Facebook", FacebookError);
  }

  private async YouTubeDownloader(url: string): Promise<IDownloadedOnDisk[]> {
      const yt = await this.Youtube(url);
      const file = await this.DownloadOnDisk(yt, "YouTube");
      return [file];
  }

  private async TwitterDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    const videoUrl = await this.Twitter(url);
    const file = await this.DownloadOnDisk(videoUrl, "Twitter");
    return [file];
  }


  private async Twitter(url:string): Promise<string> {
    const endpoint = `https://nayan-video-downloader.vercel.app/twitterdown?url=${encodeURIComponent(url)}`;
    const res = await axios.get(endpoint);

    if (res.status !== 200) {
      throw new Error("Failed to fetch video URL.");
    }
    const videoUrl:string = res.data.data.SD || res.data.data.HD 

    return videoUrl;
  }


  private async Youtube(url: string): Promise<string> {
      const endpoint = `https://nayan-video-downloader.vercel.app/ytdown?url=${encodeURIComponent(url)}`;
      const res = await axios.get(endpoint);

      if (res.status !== 200) {
        throw new Error("Failed to fetch video URL.");
      }
      const videoUrl = res.data.data.video;

      return videoUrl;

  }
  
  private detectPlatform(url: string) : string {
    const platform = detectPlatformFromURL(url);

    if (!platform) {
      throw new Error("Invalid URL or unsupported platform.");
    }
    return platform;

  } 

  public async Download(url:string): Promise<IDownloadedOnDisk[]> { 
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
    const buffer = Buffer.from(res.data, "binary");
    const mimeType = res.headers["content-type"];

    const DownloadPath = ConfigService.getDownloadPaths(platform);
    const timestamp = Date.now();

    let extension = "";
    let type: "video" | "image";
    if (mimeType.startsWith("video/") || mimeType === "application/octet-stream") {
      extension = ".mp4";
      type = "video";
    } else if (mimeType.startsWith("image/")) {
      const extFromMime = mimeType.split("/")[1]; // e.g., image/png → png
      extension = `.${extFromMime || "jpg"}`;
      type = "image";
    } else {
      throw new Error(`Unsupported media type: ${mimeType}`);
    }

    const fileName = `${timestamp}${extension}`;
    const filePath = `${DownloadPath}/${fileName}`;
    await FileService.saveFile(filePath, buffer);
    return { path: filePath, type, platform };
  }

  private async genericDownloader(url: string, platform: "TikTok" | "Instagram" | "Facebook", errorClass: any): Promise<IDownloadedOnDisk[]> {
    try {
      const result = await SnapSaver(url);
      if (!result.success) throw new errorClass(result.message || "Unknown error");
      // Facebook is the only one that returns a different structure as Resolution,
      // we need pick the SD resolution since we are targeting the mobile version
      if (platform === "Facebook") {
        if (!result.data) throw new errorClass("No data found");

          const SDResolution = result.data?.media?.filter(item => item.resolution?.includes("SD"))[0];
          result.data.media = SDResolution ? [SDResolution] :  result.data.media  ? [result.data.media[result.data.media.length - 1]] : [];
      }
      const mediaUrls = (result.data?.media || [])
        .map(item => item.url)
        .filter((url): url is string => Boolean(url))
  
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

