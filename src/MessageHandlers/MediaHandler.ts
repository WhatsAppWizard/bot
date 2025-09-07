import { Message, MessageMedia } from 'whatsapp-web.js';
import { IMediaHandler } from '../types/IMessageHandler';
import StickerRepository from '../services/Database/Stickers';
import loggerService from '../services/Logger';
import analyticsWrapper from '../services/AnalyticsWrapper';

export class MediaHandler implements IMediaHandler {
  private readonly supportedMimeTypes = ['image/jpeg', 'image/png'];
  private readonly stickerRepository: StickerRepository;

  constructor() {
    this.stickerRepository = new StickerRepository();
  }

  async canHandle(message: Message): Promise<boolean> {
    return message.hasMedia;
  }

  async handle(message: Message, userId: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      if (!message.hasMedia) {
        await message.reply("No media found in message");
        return;
      }

      const { mimetype, data } = await message.downloadMedia();

      if (this.supportedMimeTypes.includes(mimetype)) {
        await this.handleImageSticker(message, mimetype, data, userId);
      } else {
        await message.reply("We only support creating stickers from Image files only");
      }

      const processingTime = Date.now() - startTime;
      
      analyticsWrapper.trackMessageEvent('media_handled', userId, {
        mimetype,
        processingTime,
        messageId: message.id._serialized
      });
      
      loggerService.info('Media handled successfully', {
        userId,
        mimetype,
        processingTime
      });
    } catch (error) {
      loggerService.logError(error as Error, 'MediaHandler.handle', {
        userId,
        messageId: message.id._serialized
      });
      
      analyticsWrapper.trackErrorEvent('media_handler_error', 'MediaHandler', error);
    }
  }

  private async handleImageSticker(
    message: Message, 
    mimetype: string, 
    data: string, 
    userId: string
  ): Promise<void> {
    try {
      // Save sticker to database
      await this.stickerRepository.create(userId, message.timestamp, message.body || '');
      
      // Create and send sticker
      const media = new MessageMedia(mimetype, data);
      await message.reply(media, "", {
        sendMediaAsSticker: true,
        stickerAuthor: "wwz.gitnasr.com",
        stickerName: "WhatsApp Wizard v3.0",
      });

      analyticsWrapper.trackStickerEvent('created', userId, {
        mimetype,
        messageId: message.id._serialized
      });
      
      loggerService.info('Sticker created successfully', {
        userId,
        mimetype
      });
    } catch (error) {
      analyticsWrapper.trackStickerEvent('failed', userId, {
        error: error instanceof Error ? error.message : String(error),
        mimetype
      });
      
      throw error;
    }
  }

  getSupportedMimeTypes(): string[] {
    return [...this.supportedMimeTypes];
  }
}
