import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";

import ConfigService from "./Config";
import FileService from "./Files";
import QRCode from "qr-image";
import QueueService from "./Queue";
import SocketService from "./SocketHandler";
import StickerRepository from "./Database/Stickers";
import UserRepository from "./Database/Users";

class WhatsApp {
  private client: Client;
  private qrCodePath: string;
  private socketService: SocketService;

  public queueService: QueueService;

  private users: UserRepository;
  private stickers: StickerRepository;

  public isAuthenticated: boolean = false;
  public unreadChats: number = 0;

  constructor() {
    this.client = new Client({
      puppeteer: ConfigService.getPuppeteerOptions(),
      authStrategy: new LocalAuth({
        dataPath: ConfigService.getSessionPath(),
      }),
    });

    ConfigService.ensurePublicDirectoryExists();
    this.qrCodePath = ConfigService.getQrCodePath();

    this.socketService = new SocketService(this);
    this.queueService = QueueService.getInstance();

    this.users = new UserRepository();
    this.stickers = new StickerRepository();
  }

  setSocketIO(io: any) {
    this.socketService.initialize(io);
  }

  async initialize() {
    await this.client.initialize();

    this.setupWhatsAppEventHandlers();
  }

  private setupWhatsAppEventHandlers() {
    this.client.on("authenticated", () => {
      this.isAuthenticated = true;
      this.socketService.emitAuthStatus();
    });

    this.client.on("auth_failure", () => {
      this.isAuthenticated = false;
      this.socketService.emitAuthStatus();
    });

    this.client.on("disconnected", (reason) => {
      console.log("Client was disconnected", reason);
      this.isAuthenticated = false;
      this.socketService.emitAuthStatus();
    });

    this.client.once("ready", () => {
      this.isAuthenticated = true;
      this.socketService.emitAuthStatus();
      this.GetQRCode();

      // Set up message event handler
      this.setupMessageHandler();
      this.RegisterMessageCheck();
    });
  }

  private setupMessageHandler() {
    // Listen for new messages
    this.client.on("message", async (message) => {
      const chatInfo = await message.getChat();
      if (chatInfo.isGroup || chatInfo.isReadOnly) {
        // Ignore group messages and read-only chats
        return;
      }
      if (message.hasMedia) {
        const { mimetype, data } = await message.downloadMedia();
        const contactInfo = await message.getContact();

        const { body, timestamp } = message;
        if (mimetype === "image/jpeg" || mimetype === "image/png") {
          
          const userNumber = await contactInfo.getFormattedNumber();
          const CountryCode = userNumber.split(" ")[0];

          let user = await this.users.createUser({
            name: contactInfo.pushname || userNumber,
            phone: userNumber,
            platform: message.deviceType,
            country: CountryCode,
          });

          this.stickers.create(user.id, timestamp, body);

          
          const mediaPath = ConfigService.getDownloadPath(
            `${user.id}-${timestamp}.jpg`
          );

          await FileService.saveFile(mediaPath, Buffer.from(data, "base64"));

          // send media back to user as Sticker
          message.reply(MessageMedia.fromFilePath(mediaPath), "", {
            sendMediaAsSticker: true,
            stickerAuthor: "wwz.gitnasr.com",
            stickerName: "WhatsApp Wizard v3.0",
          });

         await FileService.removeFile(mediaPath);
          
        }
      }
    });
  }

  private RegisterMessageCheck() {
    setInterval(async () => {
      if (this.isAuthenticated) {
        try {
          // Get all chats
          const chats = await this.client.getChats();

          let count = 0;
          for (const chat of chats) {
            if (chat.unreadCount > 0) {
              count += chat.unreadCount;
            }
          }

          // Update unread count if changed
          if (count !== this.unreadChats) {
            this.unreadChats = count;
            this.socketService.emitUnreadCount();
          }
        } catch (error) {
          console.error("Error checking unread messages:", error);
        }
      }
    }, 5000);
  }

  GetQRCode() {
    this.client.on("qr", async (qr) => {
      const QR = QRCode.imageSync(qr, { type: "png" }) as Buffer;
      await FileService.saveFile(this.qrCodePath, QR);
      console.log("QR Code saved to:", this.qrCodePath);

      // Emit event to all connected clients
      this.socketService.emitQRUpdate();
    });
  }

  getClientStats() {
    return {
      isAuthenticated: this.isAuthenticated,
      unreadChats: this.unreadChats,
    };
  }

  async clearQRCodes() {
     FileService.removeFile(this.qrCodePath);
  }
}

export default WhatsApp;
