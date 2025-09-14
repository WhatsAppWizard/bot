import { Message } from 'whatsapp-web.js';
import { ICommandHandler } from '../types/IMessageHandler';
import loggerService from '../services/Logger';
import analyticsWrapper from '../services/AnalyticsWrapper';

export class CommandHandler implements ICommandHandler {
  private readonly supportedCommands = ['.', '/', '..',"hi"];

  async canHandle(message: Message): Promise<boolean> {
    if (!message.body) return false;
    
    const command = message.body.toLowerCase().trim();
    return this.supportedCommands.includes(command);
  }

  async handle(message: Message, userId: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      const response = `Hi there! I'm WhatsApp Wizard.\nNow you can send me any link from Facebook, TikTok, Instagram, YouTube, or Twitter, and I will download it for you.\nAdditionally, I can create stickers from images! Just send me any image, and I will make a sticker for you.`;
      
      await message.reply(response);
      
      const processingTime = Date.now() - startTime;
      
      analyticsWrapper.trackMessageEvent('command_handled', userId, {
        command: message.body,
        processingTime,
        messageId: message.id._serialized
      });
      
      loggerService.info('Command handled successfully', {
        userId,
        command: message.body,
        processingTime
      });
    } catch (error) {
      loggerService.logError(error as Error, 'CommandHandler.handle', {
        userId,
        command: message.body,
        messageId: message.id._serialized
      });
      
      analyticsWrapper.trackErrorEvent('command_handler_error', 'CommandHandler', error);
    }
  }

  getSupportedCommands(): string[] {
    return [...this.supportedCommands];
  }
}
