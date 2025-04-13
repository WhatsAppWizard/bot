import axios from "axios";
//@ts-ignore
import { ttdl } from "ruhend-scraper";
import InstagramDownloadError from "../errors/InstagramDownloadError";
import TikTokError from "../errors/TikTokError";
import { SnapSaver } from "../SnapSaver/Download";
import ConfigService from "./Config";
import FileService from "./Files";

class DownloadService {
  constructor() {}

  public async TikTokVideoDownloader(url: string): Promise<string[]> {
    try {
      let { title, username, published, video, cover, music } = await ttdl(url);

      let DirectURLs = [video];
      if (!DirectURLs.length) {
        throw new TikTokError("No direct URLs found in the response.");
      }
      const ReturnPaths: string[] = [];
      for (const DirectURL of DirectURLs) {
        if (!DirectURL) {
          throw new TikTokError("Direct URL is undefined or null");
        }
        const path = await this.DownloadOnDisk(DirectURL, "TikTok");
        if (!path) {
          throw new TikTokError("Failed to download media");
        }
        ReturnPaths.push(path);
      }
      return ReturnPaths;
    } catch (error) {
      console.error("Download error:", error);
      throw error;
    }
  }
  private async DownloadOnDisk(url: string, platform: string) {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
    });
    const buffer = Buffer.from(res.data, "binary");

    const mimeType = res.headers["content-type"];

    let DownloadPaths = ConfigService.getDownloadPaths(platform);

    if (mimeType.startsWith("video/")) {
      const rootPath = DownloadPaths.video;
      const extension = ".mp4";
      const fileName = `${Date.now()}${extension}`;
      const filePath = `${rootPath}/${fileName}`;
      await FileService.saveFile(filePath, buffer);
      return filePath;
    }

    if (mimeType.startsWith("image/")) {
      const rootPath = DownloadPaths.image;
      const extension = ".jpg";
      const fileName = `${Date.now()}${extension}`;
      const filePath = `${rootPath}/${fileName}`;
      await FileService.saveFile(filePath, buffer);
      return filePath;
    }
  }
  public async InstagramDownloader(url: string): Promise<string[]> {
    try {
      const download = await SnapSaver(
        "https://www.instagram.com/p/C51YHfWJwHK/"
      );
      if (!download.success) {
        throw new InstagramDownloadError(download.message || "Unknown error");
      }

      const media = download.data?.media || [];
      const mediaUrls = media.map((item) => item.url).filter(Boolean);
      const ReturnPaths: string[] = [];
      for (const mediaUrl of mediaUrls) {
        if (!mediaUrl) {
          throw new InstagramDownloadError("Media URL is undefined or null");
        }
        const path = await this.DownloadOnDisk(mediaUrl, "Instagram");
        if (!path) {
          throw new InstagramDownloadError("Failed to download media");
        }
        ReturnPaths.push(path);
      }
      return ReturnPaths;
    } catch (error) {
      console.error("Download error:", error);
      throw error;
    }
  }
}

export const downloadService = new DownloadService();
