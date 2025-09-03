//@ts-ignore

import chromePaths from "chrome-paths";
import fs from "fs";
import path from "path";

class ConfigService {
  private static PublicPath: string = path.join(process.cwd(), "public");
  public static getPuppeteerOptions() {
    return {
      headless: false,
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
        "--disable-dbus", // Added to prevent D-Bus connection errors
        "--disable-features=VizDisplayCompositor",
        "--force-local-ntp",
        "--disable-extensions-http-throttling",
        "--disable-sync",
        "--no-first-run",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
        "--disable-background-networking",
        "--disable-crash-reporter",
        "--disable-client-side-phishing-detection",
        "--disable-component-extensions-with-background-pages",
        "--disable-system-notification-api", // Disable system notifications
        "--disable-desktop-notifications", // Disable desktop notifications
        "--disable-logging", // Disable Chrome logging
        "--disable-ipc-flooding-protection",
        "--disable-default-apps",
        "--disable-plugins",
        "--disable-translate",
        "--no-zygote",
        "--disable-features=TranslateUI",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
  
      ],
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || chromePaths.chrome,
    };
  }
  private static isProduction() {
    return process.env.NODE_ENV == "production";
  }
  public static getSessionPath() {
    return process.env.NODE_ENV === "production" ? "BTAA" : "DEVA";
  }

  public static getScreenshotPath() {
    return path.join(this.PublicPath, "media", "screenshot.png");
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
      // Remove the screenshot path creation - it's a file, not a directory
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
}

export default ConfigService;
