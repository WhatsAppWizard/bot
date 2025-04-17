import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import { DownloadEvents, DownloadJob } from "../types/Download";

import ConfigService from "./Config";
import DownloadRepository from "./Database/Downloads";
import { DownloadStatus } from "../generated/prisma";
import ErrorsRepository from "./Database/Errors";
import FileService from "./Files";
import QRCode from "qr-image";
import QueueService from "./Queue";
import StickerRepository from "./Database/Stickers";
import TelegramService from "./Telegram";
import UserRepository from "./Database/Users";

class WhatsApp {
  private client: Client;
  private qrCodePath: string;
  

  public queueService: QueueService;
  private telegramService: TelegramService;

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

    this.queueService = QueueService.getInstance();

    this.users = new UserRepository();
    this.stickers = new StickerRepository();
    this.downloads= new DownloadRepository();

    this.telegramService = new TelegramService();
  }


  async initialize() {
    await this.client.initialize();

    this.setupWhatsAppEventHandlers();
  }

  private setupWhatsAppEventHandlers() {
   
    this.client.on("authenticated", () => {
      this.isAuthenticated = true;
      this.telegramService.sendMessage("WhatsApp is authenticated and ready to go!");
    });

    this.client.on("auth_failure", () => {
      this.isAuthenticated = false;
      this.telegramService.sendMessage("WhatsApp authentication failed. Please re-scan the QR code.");
    
      
    });

    this.client.on("disconnected", (reason) => {
      console.log("Client was disconnected", reason);
      this.isAuthenticated = false;
      this.telegramService.sendMessage("WhatsApp client was disconnected. Please re-scan the QR code.");
    });

    this.client.once("ready", () => {
      this.isAuthenticated = true;
      this.telegramService.sendMessage("WhatsApp client is ready!");

      if (this.telegramService.QrCodeMessageId) {
        // delete the message
        this.telegramService.deleteMessage(this.telegramService.QrCodeMessageId);
        this.telegramService.QrCodeMessageId = null;
        this.clearQRCodes();
      }

      // Set up message event handler
      this.setupMessageHandler();
      this.RegisterMessageCheck();
    });

    this.client.on("qr", async (qr) => {
      const QR: Buffer = QRCode.imageSync(qr, { type: "png" }) as Buffer;
      await FileService.saveFile(this.qrCodePath, QR);
   

      if (this.telegramService.QrCodeMessageId){
        await this.telegramService.updateQRCode(this.qrCodePath, this.telegramService.QrCodeMessageId);
      }
      else {
        this.telegramService.QrCodeMessageId = await this.telegramService.sendQRcode(this.qrCodePath);
      }
      
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
            const url  = urls[0];
            const downloadRepo = new DownloadRepository();

            const DownloadInDatabase = await downloadRepo.create(
              url,
              "UNKNOWN",
              user.id,
              timestamp
            );
          
          this.queueService.addJobToDownloaderQueue(`${timestamp}-${userNumber}`, {
            url: urls[0],   // For now, we Support only one file at a time.
            downloadId: DownloadInDatabase.id,
            message,
          })
          }

        }
      } catch (error) {
        console.log(error, "Error in message handler");
        
      }
    });
   
  }
  private onQueueMessage() { 
    this.queueService.on(DownloadEvents.DownloadCompleted, async (job: DownloadJob) => {
      try {
        const { download, downloadId } =  job.returnvalue;
        const { message } = job.data;
  
        
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


    this.queueService.on(DownloadEvents.DownloadFailed, async (job: DownloadJob, error:any) => {


      try {
        const { message } = job.data;
        const userMessageOnWhatsApp = await this.client.getMessageById(message.id._serialized);
        userMessageOnWhatsApp.reply("Believe me, I tried my best to download this file, but I couldn't. 🫠😔 \n\nPlease try again later");
     
        const ErrorRepo = new ErrorsRepository();
        ErrorRepo.createError(error.toString(), job.data.downloadId);

      } catch (errorFromFunction) {
        
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
          }
        } catch (error) {
          console.error("Error checking unread messages:", error);
        }
      }
    }, 5000);
  }



  getClientStats() {
    return {
      isAuthenticated: this.isAuthenticated,
      unreadChats: this.unreadChats,
    };
  }

  async clearQRCodes() {
  await  FileService.removeFile(this.qrCodePath);
  }
}

export default WhatsApp;
