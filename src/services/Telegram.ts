// Telegram Service is Used by System Admin to Manage the bot.
// It's more reliable for managing the bot itself.

import { Telegraf } from "telegraf";

class TelegramService {
  private bot = new Telegraf(process.env.BOT_TOKEN!);
  private chatId = process.env.CHAT_ID!;
  private _QrCodeMessageId: number | null = null;
    public get QrCodeMessageId(): number | null {
        return this._QrCodeMessageId;
    }
    public set QrCodeMessageId(value: number | null) {
        this._QrCodeMessageId = value;
    }
  
  constructor() {
    this.bot.launch();
    this.bot.telegram.sendMessage(
      this.chatId,
      `Welcome, System Admin!. It's ${new Date().toLocaleString()}. We are up and running!`, {
        
      }
    );
  }

  public async sendQRcode(qrCodePathAsImage: string) {
    try {
     const image =  await this.bot.telegram.sendPhoto(this.chatId, {
        source: qrCodePathAsImage,
        
      },{
         caption: "Scan the QR code to connect, 1st time @ " + new Date().toLocaleString(),
      });

      return image.message_id;
    } catch (error) {
      throw new Error("Error sending QR code: " + error);
    }
  }

    public async sendMessage(message: string) {
        try {
        await this.bot.telegram.sendMessage(this.chatId, message);
        } catch (error) {
        throw new Error("Error sending message: " + error);
        }
    }

    public async updateQRCode(qrCodePathAsImage: string, messageId:number) {

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
                    caption: "Scan the QR code to connect last refresh @ " + new Date().toLocaleString(),
                },
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

export  const telegramService =  new TelegramService();
export type TelegramServiceType = typeof telegramService;