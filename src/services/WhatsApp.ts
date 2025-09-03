import { Client, LocalAuth, Message, MessageMedia } from "whatsapp-web.js";
import { DownloadEvents, DownloadJob } from "../types/Download";
import { shortenerService } from "./Shortener";

import QRCode from "qr-image";
import { DownloadStatus } from "../generated/prisma";
import { AgentService } from "./Agent";
import AnalyticsService from "./Analytics";
import ConfigService from "./Config";
import DownloadRepository from "./Database/Downloads";
import ErrorsRepository from "./Database/Errors";
import StickerRepository from "./Database/Stickers";
import UserRepository from "./Database/Users";
import FileService from "./Files";
import QueueService from "./Queue";
import RateLimiterService from "./Ratelimiter";
import TelegramService from "./Telegram";
interface IWhatsAppStats {
  isAuthenticated: boolean;
  unreadChats: number;
  lastMessageDate: Date | null;
  lastStickerDate: Date | null;
  lastDownloadDate: Date | null;
}
class WhatsApp {
  private readonly client: Client;
  private readonly qrCodePath: string;

  public queueService: QueueService;
  private readonly telegramService: TelegramService;
  private readonly rateLimiterService: RateLimiterService;
  private readonly analyticsService = AnalyticsService;
  private readonly agentService = new AgentService();

  private readonly users: UserRepository;
  private readonly stickers: StickerRepository;
  private readonly downloads: DownloadRepository;

  public unreadChats: number = 0;

  private readonly stats:IWhatsAppStats = {
    isAuthenticated: false,
    unreadChats: 0,
    lastMessageDate: null,
    lastStickerDate: null,
    lastDownloadDate: null,
  }

  constructor() {
    this.client = new Client({
      puppeteer: ConfigService.getPuppeteerOptions(),
      authStrategy: new LocalAuth({
        dataPath: ConfigService.getSessionPath(),
      }),
      webVersion:"2.3000.1026578094"
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
      this.stats.isAuthenticated = true;
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "whatsapp_authenticated",
      });
      this.telegramService.sendMessage(
        "WhatsApp is authenticated and ready to go!"
      );
    });

    this.client.on("auth_failure", () => {
      this.stats.isAuthenticated = false;
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "whatsapp_authenticated_failure",
      });
      this.telegramService.sendMessage(
        "WhatsApp authentication failed. Please re-scan the QR code."
      );
    });

    this.client.on("disconnected", (reason) => {
      console.log("Client was disconnected", reason);
      this.stats.isAuthenticated = false;
      this.analyticsService.trackEvent("system_event", "system", {
        event_type: "whatsapp_disconnected",
      });
      this.telegramService.sendMessage(
        "WhatsApp client was disconnected. Please re-scan the QR code."
      );
    });

    this.client.once("ready", () => {
      this.stats.isAuthenticated = true;
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
      await this.telegramService.sendMessage(
        `Call from ${call.from} rejected.`
      );
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

    const commands = [".", "/", ".."];

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

        // Update stats
        this.stats.lastMessageDate = new Date(timestamp * 1000);

        await chatInfo.sendSeen();

        if (hasMedia) {
          const { mimetype, data } = await message.downloadMedia();

          if (mimetype === "image/jpeg" || mimetype === "image/png") {
          await  this.stickers.create(user.id, timestamp, body);
            const media = new MessageMedia(mimetype, data);

         await   message.reply(media, "", {
              sendMediaAsSticker: true,
              stickerAuthor: "wwz.gitnasr.com",
              stickerName: "WhatsApp Wizard v3.0",
            });
            this.stats.lastStickerDate = new Date(timestamp * 1000);

            this.analyticsService.trackEvent("sticker_created", user.id);
          } else {
          await  message.reply(
              "We only support creating stickers from Image files only"
            );
          }
        }

        if (body.length > 2 && !hasMedia && links.length == 0) {
          const response = await this.agentService.sendMessage(body, user.id);
          await chatInfo.sendSeen();
          await message.reply(response);
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

            await this.queueService.addJobToDownloaderQueue(
              `${timestamp}-${userNumber}`,
              {
                url: urls[0], // For now, we Support only one file at a time.
                downloadId: DownloadInDatabase.id,
                message,
              }
            );
        await chatInfo.sendSeen();

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

          for (const element of download) {
            const { path, platform } = element;

            // Get the message object
            const userMessageOnWhatsApp = await this.client.getMessageById(
              message.id._serialized
            );

            if (platform === "YouTube") {
              // For YouTube, shorten the URL and send it
              try {
                const shortenedUrl = await shortenerService.shortenUrl(path);
                const MessageText = `Here's your YouTube video URL:\n ${shortenedUrl} \n Be Advised this is a Temporary fix `;

                if (!userMessageOnWhatsApp) {
                  const chat = await this.client.getChatById(message.from);
                  await chat.sendMessage(MessageText);
                } else {
                  await userMessageOnWhatsApp.reply(MessageText);
                }
              } catch (error) {
                console.error("Error shortening YouTube URL:", error);
                // Fallback to original URL if shortening fails
                if (!userMessageOnWhatsApp) {
                  const chat = await this.client.getChatById(message.from);
                  await chat.sendMessage(
                    `Here's your YouTube video URL:\n${path}`
                  );
                } else {
                  await userMessageOnWhatsApp.reply(
                    `Here's your YouTube video URL:\n${path}`
                  );
                }
              }
            } else {
              // For other platforms, download and send the media
              const media = MessageMedia.fromFilePath(path);
              if (!userMessageOnWhatsApp) {
                const chat = await this.client.getChatById(message.from);
                await chat.sendMessage(media);
              } else {
                await userMessageOnWhatsApp.reply(media);
              }
              await FileService.removeFile(path);
            }

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
          this.stats.lastDownloadDate = new Date();
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
            "Believe me, I tried my best to download this file, but something went error, don't worry i'm automatically reported it to Mahmoud and he will fix it soon. 🫠😔 \n\nPlease try again later"
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
      let totalUnreadMessages = 0;
      // Get all chats
      const chats = await this.client.getChats();
      for (const chat of chats) {
        if (!chat.isGroup && !chat.isReadOnly) {
          // Count unread messages in each chat
          const unreadCount = chat.unreadCount || 0;
          totalUnreadMessages += unreadCount;
        }
      }
      this.stats.unreadChats = totalUnreadMessages;
     
    } catch (error) {
     
      this.analyticsService.trackEvent("error_checking_unread_messages", "", {
        error,
      });
      this.telegramService.sendMessage(
        "Error checking unread messages: " + error
      );
      throw error;
    }
  }

  private async RegisterMessageCheck() {
    this.onTelegramMessage();
   await this.getUnreadChats();
    setInterval(async () => {
      if (this.stats.isAuthenticated) {
        await this.getUnreadChats();
      }
    }, 5000);
  }

  getClientStats() {
    return this.stats;
  }

  async clearQRCodes() {
    await FileService.removeFile(this.qrCodePath);
  }
}

export default WhatsApp;
