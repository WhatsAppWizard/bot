import { Client, LocalAuth, Message, MessageMedia } from "whatsapp-web.js";
import { DownloadEvents, DownloadJob } from "../types/Download";

import { AgentService } from "./Agent";
import AnalyticsService from "./Analytics";
import ConfigService from "./Config";
import DownloadRepository from "./Database/Downloads";
import { DownloadStatus } from "../generated/prisma";
import ErrorsRepository from "./Database/Errors";
import FileService from "./Files";
import QRCode from "qr-image";
import QueueService from "./Queue";
import RateLimiterService from "./Ratelimiter";
import StickerRepository from "./Database/Stickers";
import TelegramService from "./Telegram";
import UserRepository from "./Database/Users";

class WhatsApp {
  private client: Client;
  private qrCodePath: string;

  public queueService: QueueService;
  private telegramService: TelegramService;
  private rateLimiterService: RateLimiterService;
  private analyticsService = AnalyticsService;
  private agentService = new AgentService();

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

    this.rateLimiterService = new RateLimiterService();

    ConfigService.ensurePublicDirectoryExists();
    this.qrCodePath = ConfigService.getQrCodePath();

    this.queueService = QueueService.getInstance();

    this.users = new UserRepository();
    this.stickers = new StickerRepository();
    this.downloads = new DownloadRepository();

    this.telegramService = TelegramService.getInstance();
  }

  async initialize() {
    await this.client.initialize();

    this.setupWhatsAppEventHandlers();
  }

  private setupWhatsAppEventHandlers() {
    this.client.on("authenticated", () => {
      this.isAuthenticated = true;
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "whatsapp_authenticated",
      });
      this.telegramService.sendMessage(
        "WhatsApp is authenticated and ready to go!"
      );
    });

    this.client.on("auth_failure", () => {
      this.isAuthenticated = false;
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "whatsapp_authenticated_failure",
      });
      this.telegramService.sendMessage(
        "WhatsApp authentication failed. Please re-scan the QR code."
      );
    });

    this.client.on("disconnected", (reason) => {
      console.log("Client was disconnected", reason);
      this.isAuthenticated = false;
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "whatsapp_disconnected",
      });
      this.telegramService.sendMessage(
        "WhatsApp client was disconnected. Please re-scan the QR code."
      );
    });

    this.client.once("ready", () => {
      this.isAuthenticated = true;
      this.telegramService.sendMessage("WhatsApp client is ready!");
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "whatsapp_ready",
      });

      if (this.telegramService.QrCodeMessageId) {
        // delete the message
        this.telegramService.deleteMessage(
          this.telegramService.QrCodeMessageId
        );
        this.telegramService.QrCodeMessageId = null;
        this.clearQRCodes();
        this.analyticsService.trackEvent("system_event", "system", {
          event_type: "qrcode_authentication_completed",
        });
      }

      // Set up message event handler
      this.onQueueMessage();
      this.setupMessageHandler();
      this.RegisterMessageCheck();
      this.registerBlockOnCalls();
    });

    this.client.on("qr", async (qr) => {
      const QR: Buffer = QRCode.imageSync(qr, { type: "png" }) as Buffer;
      await FileService.saveFile(this.qrCodePath, QR);

      if (this.telegramService.QrCodeMessageId) {
        await this.telegramService.updateQRCode(
          this.qrCodePath,
          this.telegramService.QrCodeMessageId
        );
      } else {
        this.telegramService.QrCodeMessageId =
          await this.telegramService.sendQRcode(this.qrCodePath);
      }
    });
  }
  private registerBlockOnCalls() {
    this.client.on("call", async (call) => {
      call.reject();
      console.log("Call rejected:", call);
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "call_rejected",
      });
      this.telegramService.sendMessage(`Call from ${call.from} rejected.`);
      const userId = call.from;
      if (!userId) return;
      const user = await this.client.getContactById(userId);

      const chat = await user.getChat();
      await chat.sendMessage(
        "You're Blocked due to spammy behavior. \n\nPlease contact us on our website to unblock you."
      );

      await user.block();
    });
  }
  private async setupBotCommands(message: Message) {
    const command = message.body.toLowerCase().trim();

    const commands = [
      "hi whatsapp wizard",
      "hi",
      "hello",
      "hey",
      "whatsapp wizard",
      "wwz",
      "wwz bot",
      "wwz bot help",
      ".",
      "help",
      "commands",
      "start",
      "stickers",
      "اهلا",
      "download",
      "/",
      "..",
    ];

    if (commands.includes(command)) {
      message.reply(
        `Hi there! I'm WhatsApp Wizard.\nNow you can send me any link from Facebook, TikTok, Instagram, YouTube, or Twitter, and I will download it for you.\nAdditionally, I can create stickers from images! Just send me any image, and I will make a sticker for you.`
      );
    }
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
        await this.setupBotCommands(message);
        const { body, timestamp, hasMedia, links } = message;
        const contactInfo = await message.getContact();
        const userNumber = await contactInfo.getFormattedNumber();
        const countryCode = userNumber.split(" ")[0];

        const userPayload = {
          name: contactInfo.pushname || userNumber,
          phone: userNumber,
          platform: message.deviceType,
          country: countryCode,
        };

        let user = await this.users.createOrUpdateUser(userPayload);
        this.analyticsService.identifyUser(user.id, {
          ...userPayload,
          firstSeen: new Date(),
        });

        this.analyticsService.trackEvent("message_received", user.id, {
          has_media: message.hasMedia,
          has_links: links.length > 0,
          platform: message.deviceType,
          message: JSON.stringify(message),
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

            this.analyticsService.trackEvent("sticker_created", user.id);
          } else {
            message.reply(
              "We only support creating stickers from Image files only"
            );
          }
        }

        if (body.length > 2 && !hasMedia && links.length == 0) {
          const response = await this.agentService.sendMessage(body, user.id);
          message.reply(response);
        }

        if (links.length > 0) {
          // Check if the user is rate limited
          const isRateLimited = await this.rateLimiterService.isRatedLimited(
            userNumber
          );
          if (isRateLimited) {
            this.analyticsService.trackEvent("rate_limited", user.id);
            message.reply(
              "To save our resources, Please wait a moment before sending another request. R409"
            );
            return;
          }
          const urls = links.map((urls) => urls.link);

          if (urls) {
            const url = urls[0];
            const downloadRepo = new DownloadRepository();

            const DownloadInDatabase = await downloadRepo.create(
              url,
              "UNKNOWN",
              user.id,
              timestamp
            );

            this.analyticsService.trackEvent("download_requested", user.id, {
              message: JSON.stringify(message),
            });

            this.queueService.addJobToDownloaderQueue(
              `${timestamp}-${userNumber}`,
              {
                url: urls[0], // For now, we Support only one file at a time.
                downloadId: DownloadInDatabase.id,
                message,
              }
            );
          }
        }
      } catch (error) {
        console.log(error, "Error in message handler");
      }
    });
  }
  private onQueueMessage() {
    this.queueService.on(
      DownloadEvents.DownloadCompleted,
      async (job: DownloadJob) => {
        try {
          const { download, downloadId } = job.returnvalue;
          const { message } = job.data;

          for (let index = 0; index < download.length; index++) {
            const element = download[index];
            const { path } = element;

            // Check if it's path or url

            let media;

            console.dir(media);

            if (path.startsWith("https://")) {
              // Handle URL case
              media = await MessageMedia.fromUrl(path, {unsafeMime:true});
            } else {
              // Handle local file path case
              media = MessageMedia.fromFilePath(path);
            }

            // We're forced to get the message id and reply though client not Message object itself.
            // since the BullMQ worker converts all data to string and we lose the Message object functions.
            const userMessageOnWhatsApp = await this.client.getMessageById(
              message.id._serialized
            );
            if (!userMessageOnWhatsApp) {
              console.error(
                "Message not found: Properly The Message is Deleted",
                message.id._serialized
              );
              const chat = await this.client.getChatById(message.from);
              await chat.sendMessage(media);
            } else {
              userMessageOnWhatsApp.reply(media);
            }

            if (!path.startsWith("https://"))
              await FileService.removeFile(path);

            this.analyticsService.trackEvent(
              "download_response",
              job.data.message.from,
              { message }
            );
          }
          await this.downloads.updateStatusById(
            downloadId,
            DownloadStatus.SENT
          );
        } catch (error) {
          console.error("Error in onQueueMessage:", error);

          this.analyticsService.trackEvent("error_onQueueMessage", "", {
            error,
            job,
          });
        }
      }
    );

    this.queueService.on(
      DownloadEvents.DownloadFailed,
      async (job: DownloadJob, error: any) => {
        try {
          const { message } = job.data;
          const userMessageOnWhatsApp = await this.client.getMessageById(
            message.id._serialized
          );
          userMessageOnWhatsApp.reply(
            "Believe me, I tried my best to download this file, but I couldn't. 🫠😔 \n\nPlease try again later"
          );

          const ErrorRepo = new ErrorsRepository();
          ErrorRepo.createError(error.toString(), job.data.downloadId);
        } catch (errorFromFunction) {}
      }
    );
  }

  private onTelegramMessage() {
    this.telegramService.on("broadcast-requested", async (message) => {
      try {
        console.log("Broadcast message received:", message);
        let count = 0;
        const chats = await this.client.getChats();
        for (const chat of chats) {
          count++;
          if (!chat.isGroup) {
            await chat.sendMessage(message);
          }
        }
        console.log(`Broadcast message sent to ${count} chats.`);
        this.telegramService.sendMessage(
          `Broadcast message sent to ${count} chats.`
        );
      } catch (error) {
        console.error("Error sending broadcast message:", error);
      }
    });
  }

  private async getUnreadChats() {
    try {
      const HashMapOfNumbersAndUnreadMessages: Map<string, Message[]> = new Map<
        string,
        Message[]
      >();
      // Get all chats
      const chats = await this.client.getChats();

      let count = 0;
      for (const chat of chats) {
        if (chat.unreadCount > 0) {
          // get the unread messages to handle them
          const messages = (await chat.fetchMessages({ limit: Infinity }))
            .reverse()
            .slice(0, chat.unreadCount);

          HashMapOfNumbersAndUnreadMessages.set(chat.id._serialized, messages);

          count += chat.unreadCount;
        }
      }

      // Update unread count if changed
      if (count !== this.unreadChats) {
        this.unreadChats = count;
      }

      return HashMapOfNumbersAndUnreadMessages;
    } catch (error) {
      console.error("Error checking unread messages:", error);
      this.analyticsService.trackEvent("error_checking_unread_messages", "", {
        error,
      });
      this.telegramService.sendMessage(
        "Error checking unread messages: " + error
      );
      throw error;
    }
  }

  private RegisterMessageCheck() {
    this.onTelegramMessage();
    this.getUnreadChats();
    setInterval(async () => {
      if (this.isAuthenticated) {
        await this.getUnreadChats();
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
    await FileService.removeFile(this.qrCodePath);
  }
}

export default WhatsApp;
