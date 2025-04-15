import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";

import QRCode from "qr-image";
import { DownloadStatus } from "../generated/prisma";
import { DownloadEvents, DownloadJob } from "../types/Download";
import ConfigService from "./Config";
import DownloadRepository from "./Database/Downloads";
import StickerRepository from "./Database/Stickers";
import UserRepository from "./Database/Users";
import FileService from "./Files";
import QueueService from "./Queue";
import SocketService from "./SocketHandler";

class WhatsApp {
  private client: Client;
  private qrCodePath: string;
  private socketService: SocketService;

  public queueService: QueueService;

  private users: UserRepository;
  private stickers: StickerRepository;
  private downloads: DownloadRepository;

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
    this.downloads= new DownloadRepository();
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
      try {
        const chatInfo = await message.getChat();
        if (chatInfo.isGroup || chatInfo.isReadOnly) {
          // Ignore group messages and read-only chats
          return;
        }
        const { body, timestamp, hasMedia, links, reply } = message;
        const contactInfo = await message.getContact();
        const userNumber = await contactInfo.getFormattedNumber();
        const countryCode = userNumber.split(" ")[0];

        let user = await this.users.createOrUpdateUser({
          name: contactInfo.pushname || userNumber,
          phone: userNumber,
          platform: message.deviceType,
          country: countryCode,
        });

        if (hasMedia) {
          const { mimetype, data } = await message.downloadMedia();

          if (mimetype === "image/jpeg" || mimetype === "image/png") {
            this.stickers.create(user.id, timestamp, body);
            const media = new MessageMedia(mimetype, data);

            message.reply(media, "", {
              sendMediaAsSticker: true,
              stickerAuthor: "wwz.gitnasr.com",
              stickerName: "WhatsApp Wizard v3.0",
            });

          }
        }

        if (links.length > 0) {
          const urls = links.map((urls) => urls.link);

          if (urls) {
          this.queueService.addJobToDownloaderQueue(`${timestamp}-${userNumber}`, {
            url: urls[0],
            message,
            userId: user.id,
            timestamp
          })
          }

        }
      } catch (error) {
      console.log("🚀 ~ WhatsApp ~ this.client.on ~ error:", error)
      }
    });
   
  }
  private onQueueMessage() { 
    this.queueService.on(DownloadEvents.DownloadCompleted, async (job: DownloadJob) => {
      try {
        const { download, downloadId } =  job.returnvalue;
        const { message } = job.data;
  
        // For now, we Support only one file at a time.
        // We Added this to support multiple files in the future.
        for (let index = 0; index < download.length; index++) {
          const element = download[index];
          const { path } = element;
  
        
  
          // Make MessageMedia from filePath
          const media =  MessageMedia.fromFilePath(path);
  
  
            // We're forced to get the message id and reply though client not Message object itself.
        // since the BullMQ worker converts all data to string and we lose the Message object functions.
          const userMessageOnWhatsApp = await this.client.getMessageById(message.id._serialized);
  
          userMessageOnWhatsApp.reply(media);

          await FileService.removeFile(path);
          
         
  
  
          
        }
        await this.downloads.updateStatusById(downloadId,DownloadStatus.SENT);
      } catch (error) {
        console.error("Error in onQueueMessage:", error);

      }
     


    
          
    })
  }
  private RegisterMessageCheck() {
    this.onQueueMessage();
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
