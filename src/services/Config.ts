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
      ],
    };
  }

  public static getSessionPath() {
    return process.env.NODE_ENV === "production" ? "BTA" : "DEV";
  }

  public static ensurePublicDirectoryExists() {
    if (!fs.existsSync(this.PublicPath)) {
      fs.mkdirSync(this.PublicPath, { recursive: true });
      fs.mkdirSync(path.join(this.PublicPath, "media"), { recursive: true });
      fs.mkdirSync(path.join(this.PublicPath, "qrcodes"), { recursive: true });
    }
  }
  public static getQrCodePath() {
    return path.join(this.PublicPath, "qrcodes", "qr-code.png");
  }

  public static getDownloadPaths(platform?: string) {
    if (!platform) {
      platform = "default";
    }
    if (!fs.existsSync(path.join(this.PublicPath, "media", platform))) {
      fs.mkdirSync(path.join(this.PublicPath, "media", platform), { recursive: true });
      
    }
    return path.join(this.PublicPath, "media", platform );
  }

  public static getDownloadPath(downloadName: string) {
    return path.join(this.PublicPath, "media", `${downloadName}.jpg`);
  }
}

export default ConfigService;
