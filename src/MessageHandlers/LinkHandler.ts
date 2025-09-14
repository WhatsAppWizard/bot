import { Message } from 'whatsapp-web.js';
import { ILinkHandler } from '../types/IMessageHandler';
import DownloadRepository from '../services/Database/Downloads';
import QueueService from '../services/Queue';
import RateLimiterService from '../services/Ratelimiter';
import loggerService from '../services/Logger';
import analyticsWrapper from '../services/AnalyticsWrapper';

export class LinkHandler implements ILinkHandler {
  private readonly downloadRepository: DownloadRepository;
  private readonly queueService: QueueService;
  private readonly rateLimiterService: RateLimiterService;
  private readonly supportedDomains = [
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'youtu.be',
    'twitter.com',
    'x.com'
  ];

  constructor() {
    this.downloadRepository = new DownloadRepository();
    this.queueService = QueueService.getInstance();
    this.rateLimiterService = new RateLimiterService();
  }

  async canHandle(message: Message): Promise<boolean> {
    return message.links && message.links.length > 0;
  }

  async handle(message: Message, userId: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      if (!message.links || message.links.length === 0) {
        return;
      }

      const contactInfo = await message.getContact();
      const userNumber = await contactInfo.getFormattedNumber();

      // Check rate limiting
      const isRateLimited = await this.rateLimiterService.isRatedLimited(userNumber);
      if (isRateLimited) {
        analyticsWrapper.trackRateLimitEvent(userId, userNumber);
        await message.reply(
          "To save our resources, Please wait a moment before sending another request."
        );
        return;
      }

      const urls = message.links.map(link => link.link);
      const url = urls[0]; // Support only one URL at a time

      if (url && this.isSupportedDomain(url)) {
        await this.processDownloadRequest(message, url, userId, userNumber);
      } else {
        await message.reply("Sorry, I don't support downloads from this platform yet.");
      }

      const processingTime = Date.now() - startTime;
      
      analyticsWrapper.trackMessageEvent('link_handled', userId, {
        url,
        processingTime,
        messageId: message.id._serialized
      });
      
      loggerService.info('Link handled successfully', {
        userId,
        url,
        processingTime
      });
    } catch (error) {
      loggerService.logError(error as Error, 'LinkHandler.handle', {
        userId,
        messageId: message.id._serialized
      });
      
      analyticsWrapper.trackErrorEvent('link_handler_error', 'LinkHandler', error);
    }
  }

  private async processDownloadRequest(
    message: Message, 
    url: string, 
    userId: string, 
    userNumber: string
  ): Promise<void> {
    try {
      // Create download record in database
      const downloadRecord = await this.downloadRepository.create(
        url,
        "UNKNOWN",
        userId,
        message.timestamp
      );

      // Add job to download queue
      await this.queueService.addJobToDownloaderQueue(
        `${message.timestamp}-${userNumber}`,
        {
          url,
          downloadId: downloadRecord.id,
          message,
        }
      );

      analyticsWrapper.trackDownloadEvent('requested', userId, {
        url,
        downloadId: downloadRecord.id,
        messageId: message.id._serialized
      });
      
      loggerService.info('Download request queued', {
        userId,
        url,
        downloadId: downloadRecord.id
      });
    } catch (error) {
      analyticsWrapper.trackDownloadEvent('request_failed', userId, {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  private isSupportedDomain(url: string): boolean {
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return this.supportedDomains.some(supportedDomain => 
        domain.includes(supportedDomain)
      );
    } catch {
      return false;
    }
  }

  getSupportedDomains(): string[] {
    return [...this.supportedDomains];
  }
}
