//@ts-ignore

import chromePaths from "chrome-paths";
import fs from "fs";
import path from "path";

class ConfigService {
  private static PublicPath: string = path.join(process.cwd(), "public");
  public static getPuppeteerOptions() {
    return {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-gpu",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || chromePaths.chrome,
    };
  }
  private static isProduction() {
    return process.env.NODE_ENV == "production";
  }
  public static getSessionPath() {
    return process.env.NODE_ENV === "production" ? "BTA" : "DEV";
  }

  public static ensurePublicDirectoryExists() {
    const base = this.PublicPath;
    const media = path.join(base, "media");
    const qrcodes = path.join(base, "qrcodes");

    try {
      if (!fs.existsSync(base)) {
        fs.mkdirSync(base, { recursive: true });
      }
      if (!fs.existsSync(media)) {
        fs.mkdirSync(media, { recursive: true });
      }
      if (!fs.existsSync(qrcodes)) {
        fs.mkdirSync(qrcodes, { recursive: true });
      }
    } catch (err) {
      console.error("Error creating public directories:", err);
    }
  }

  public static getQrCodePath() {
    return path.join(this.PublicPath, "qrcodes", "qr-code.png");
  }

  public static getDownloadPaths(platform?: string) {
    platform ??= "default";
    if (!fs.existsSync(path.join(this.PublicPath, "media", platform))) {
      fs.mkdirSync(path.join(this.PublicPath, "media", platform), {
        recursive: true,
      });
    }
    return path.join(this.PublicPath, "media", platform);
  }

  public static getDownloadPath(downloadName: string) {
    return path.join(this.PublicPath, "media", `${downloadName}.jpg`);
  }

  public static getRedis() {
    return process.env.REDIS_URL || "redis://127.0.0.1:6379";
  }

  public static getHardcodedRatelimit() {
    return 10;
  }

  public static getPostHogApiKey() {
    return process.env.POSTHOG_API_KEY;
  }
  public static getPostHogHost() {
    return process.env.POSTHOG_HOST;
  }

  public static getMongoose() {
    return process.env.MONGODB_URI!;
  }
}

export default ConfigService;
