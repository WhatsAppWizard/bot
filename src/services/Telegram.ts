// Telegram Service is Used by System Admin to Manage the bot.
// It's more reliable for managing the bot itself.

import { EventEmitter } from "stream";
import { Telegraf } from "telegraf";

class TelegramService extends EventEmitter {
  private bot = new Telegraf(process.env.BOT_TOKEN!);
  private chatId = process.env.CHAT_ID!;
  private _QrCodeMessageId: number | null = null;
  private static instance: TelegramService;

  public get QrCodeMessageId(): number | null {
    return this._QrCodeMessageId;
  }
  public set QrCodeMessageId(value: number | null) {
    this._QrCodeMessageId = value;
  }

  private constructor() {
    super();
    this.bot.command("broadcast", (ctx) => {
      const message = ctx.message.text.split(" ").slice(1).join(" ");
      this.emit("broadcast-requested", message);
      ctx.reply("Broadcast message received. Processing...");
    });
    this.bot.command("unhandled", (ctx) => {
      // Planned: Handle unhandled chats
      this.emit("handle-unhandled-chats");
      ctx.reply("Handling unhandled chats...");
    });
    this.bot.launch();
    this.bot.telegram.sendMessage(
      this.chatId,
      `Welcome, System Admin!. It's ${new Date().toLocaleString()}. We are up and running!`,
      {}
    );
  }

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public async sendQRcode(qrCodePathAsImage: string) {
    try {
      const image = await this.bot.telegram.sendPhoto(
        this.chatId,
        {
          source: qrCodePathAsImage,
        },
        {
          caption:
            "Scan the QR code to connect, 1st time @ " +
            new Date().toLocaleString(),
        }
      );

      return image.message_id;
    } catch (error) {
   
    }
  }

  public async sendMessage(message: string) {
    try {
      await this.bot.telegram.sendMessage(this.chatId, message);
    } catch (error) {
      throw new Error("Error sending message: " + error);
    }
  }

  public async sendScreenshot(screenshotPath: string) {
    try {
      await this.bot.telegram.sendPhoto(
        this.chatId,
        {
          source: screenshotPath,
        },
        {
          caption: "Screenshot taken at " + new Date().toLocaleString(),
        }
      );
    } catch (error) {
      throw new Error("Error sending screenshot: " + error);
    }
  }

  public async updateQRCode(qrCodePathAsImage: string, messageId: number) {
    try {
      await this.bot.telegram.editMessageMedia(
        this.chatId,
        messageId,
        undefined,
        {
          type: "photo",
          media: {
            source: qrCodePathAsImage,
          },
          caption:
            "Scan the QR code to connect last refresh @ " +
            new Date().toLocaleString(),
        }
      );
    } catch (error) {
      throw new Error("Error updating QR code: " + error);
    }
  }

  public async deleteMessage(messageId: number) {
    try {
      await this.bot.telegram.deleteMessage(this.chatId, messageId);
    } catch (error) {
      throw new Error("Error deleting message: " + error);
    }
  }
}

export default TelegramService;
