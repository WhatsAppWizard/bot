import axios from "axios";
import InstagramError from "../errors/InstagramError";
import TikTokError from "../errors/TikTokError";
import { SnapSaver } from "../SnapSaver/Download";
import ConfigService from "./Config";
import FileService from "./Files";
interface IDownloadedOnDisk {
  path: string;
  type: "video" | "image";
}
class DownloadService {
  constructor() {}
  public async TikTokVideoDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    return this.genericDownloader(url, "TikTok", TikTokError);
  }
  
  public async InstagramDownloader(url: string): Promise<IDownloadedOnDisk[]> {
    return this.genericDownloader(url, "Instagram", InstagramError);
  }
  

  private async DownloadOnDisk(
    url: string,
    platform: string
  ): Promise<IDownloadedOnDisk> {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(res.data, "binary");
    const mimeType = res.headers["content-type"];

    const DownloadPaths = ConfigService.getDownloadPaths(platform);
    const timestamp = Date.now();

    let extension = "";
    let type: "video" | "image";
    if (mimeType.startsWith("video/")) {
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
    const filePath = `${DownloadPaths[type]}/${fileName}`;
    await FileService.saveFile(filePath, buffer);
    return { path: filePath, type };
  }

  private async genericDownloader(url: string, platform: "TikTok" | "Instagram", errorClass: any): Promise<IDownloadedOnDisk[]> {
    try {
      const result = await SnapSaver(url);
      if (!result.success) throw new errorClass(result.message || "Unknown error");
  
      const mediaUrls = (result.data?.media || [])
        .map(item => item.url)
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

