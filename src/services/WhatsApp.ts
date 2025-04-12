import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";

import fs from "fs";
import path from "path";
import QRCode from "qr-image";
import StickersService from "./Database/Stickers";
import Users from "./Database/Users";
import QueueService from "./Queue";
import SocketHandler from "./SocketHandler";

class WhatsApp {
  private client: Client;
  private qrCodePath: string;
  private socketHandler: SocketHandler;
  public isAuthenticated: boolean = false;
  public unreadChats: number = 0;
  public queueService: QueueService;

  private users: Users;
  private stickers: StickersService;

  constructor() {
    this.client = new Client({
      puppeteer: {
        headless: false,
      },
      authStrategy: new LocalAuth({
        dataPath: process.env.NODE_ENV === "production" ? "BTA" : "DEV",
      }),
    });

    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    this.qrCodePath = path.join(publicDir, "qr-code.png");

    // Initialize socket handler
    this.socketHandler = new SocketHandler(this);
    this.queueService = QueueService.getInstance();

    this.users = new Users();
    this.stickers = new StickersService();
  }

  setSocketIO(io: any) {
    this.socketHandler.initialize(io);
  }

  async initialize() {
    await this.client.initialize();

    this.setupWhatsAppEventHandlers();
  }

  private setupWhatsAppEventHandlers() {
    // Handle authentication events
    this.client.on("authenticated", () => {
      console.log("Client is authenticated!");
      this.isAuthenticated = true;
      this.socketHandler.emitAuthStatus();
    });

    this.client.on("auth_failure", () => {
      console.log("Authentication failed!");
      this.isAuthenticated = false;
      this.socketHandler.emitAuthStatus();
    });

    this.client.on("disconnected", (reason) => {
      console.log("Client was disconnected", reason);
      this.isAuthenticated = false;
      this.socketHandler.emitAuthStatus();
    });

    this.client.once("ready", () => {
      console.log("Client is ready!");
      this.isAuthenticated = true;
      this.socketHandler.emitAuthStatus();
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
      if (chatInfo.isGroup) {
        return; // We're not interested in group messages .
      }
      if (message.hasMedia) {




        const media = await message.downloadMedia();
        const contactInfo = await message.getContact();

        const mediaType = media.mimetype;
        const {   id: { id }, from, body, timestamp,  } = message;
        if (mediaType === "image/jpeg" || mediaType === "image/png") {
         const userNumber = await contactInfo.getFormattedNumber();
         const CountryCode = userNumber.split(" ")[0];
         
          let user = await this.users.createUser({
            name: contactInfo.pushname || userNumber,
            phone: userNumber,
            platform: message.deviceType,
            country: CountryCode,
          });
          const mediaPath = path.join(
            process.cwd(),
            "public",
            "media",
            id + ".png"
          );
          fs.writeFileSync(mediaPath, Buffer.from(media.data, "base64"));

          // send media back to user as Sticker
          message.reply(MessageMedia.fromFilePath(mediaPath), "", {
            sendMediaAsSticker: true,
            stickerAuthor: "wwz.gitnasr.com",
            stickerName: "WhatsApp Wizard v3.0",
          });

          fs.rmSync(mediaPath);
          this.stickers.create(user.id, timestamp, body);
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
            this.socketHandler.emitUnreadCount();
          }
        } catch (error) {
          console.error("Error checking unread messages:", error);
        }
      }
    }, 5000);
  }

  GetQRCode() {
    this.client.on("qr", (qr) => {
      const QR = QRCode.imageSync(qr, { type: "png" });
      // Save QR code to file
      fs.writeFileSync(this.qrCodePath, QR);
      console.log("QR Code saved to:", this.qrCodePath);

      // Emit event to all connected clients
      this.socketHandler.emitQRUpdate();
    });
  }

  getClientStats() {
    return {
      isAuthenticated: this.isAuthenticated,
      unreadChats: this.unreadChats,
    };
  }

  clearQRCodes() {
    try {
      // Check if QR code file exists
      if (fs.existsSync(this.qrCodePath)) {
        fs.unlinkSync(this.qrCodePath);
      }
    } catch (error) {
      console.error("Error deleting QR code file:", error);
    }
  }
}

export default WhatsApp;
