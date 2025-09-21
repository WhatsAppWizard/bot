export class MessageUtils {
  private static readonly TELEGRAM_CHANNEL_INFO =
    "\n\nhttps://t.me/gitnasr\nSubscribe to Our Telegram Channel for Status Updates";

  static appendTelegramChannelInfo(message: string): string {
    return message + this.TELEGRAM_CHANNEL_INFO;
  }

  static createErrorMessage(baseMessage: string): string {
    return this.appendTelegramChannelInfo(baseMessage);
  }
}
