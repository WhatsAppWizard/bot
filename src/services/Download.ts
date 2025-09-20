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
  public async DownloadOnDisk(
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
}

export const downloadService = new DownloadService();
