import { Message } from 'whatsapp-web.js';
import { ILinkHandler } from '../types/IMessageHandler';
import DownloadRepository from '../services/Database/Downloads';
import QueueService from '../services/Queue';
import RateLimiterService from '../services/Ratelimiter';
import loggerService from '../services/Logger';
import analyticsWrapper from '../services/AnalyticsWrapper';
import { MessageUtils } from '../utils/MessageUtils';

export class LinkHandler implements ILinkHandler {
  private readonly queueService: QueueService;
  private readonly rateLimiterService: RateLimiterService;

  constructor() {
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
      const chatInfo = await message.getChat();

      const urls = message.links.map(link => link.link);
      const url = urls[0]; // Support only one URL at a time

      // Check rate limiting
      const isRateLimited = await this.rateLimiterService.isRatedLimited(userNumber);
      if (isRateLimited) {
        analyticsWrapper.trackRateLimitEvent(userId, userNumber);
        
        // Only send rate limit message in private chats, not in groups
        if (!chatInfo.isGroup) {
          const rateLimitMessage = MessageUtils.createErrorMessage("To save our resources, Please wait a moment before sending another request.");
          await message.reply(rateLimitMessage);
        }
        return;
      }

      // For group chats, only process if this is a quoted message (handled by MessageProcessor)
      if (chatInfo.isGroup) {
        loggerService.debug('Processing quoted link message in group chat', {
          userId,
          groupId: chatInfo.id._serialized,
          messageId: message.id._serialized,
          url
        });
      }

      if (url) {
        await this.processDownloadRequest(message, url, userId, userNumber);
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
      // Use current timestamp if message.timestamp is undefined (for quoted messages)
      const timestamp = message.timestamp ? BigInt(message.timestamp) : BigInt(Date.now());
      
      loggerService.debug('Creating download record', {
        url,
        userId,
        timestamp: timestamp.toString(),
        messageId: message.id._serialized,
        hasTimestamp: !!message.timestamp
      });
      
   
      // Get chat info to determine if it's a group
      const chatInfo = await message.getChat();

      // Prepare message data for the queue
      const messageData = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        timestamp: message.timestamp || Date.now(),
        body: message.body,
        type: message.type,
        isGroup: chatInfo.isGroup,
        isForwarded: message.isForwarded,
        fromMe: message.fromMe,
        hasMedia: message.hasMedia,
        hasQuotedMsg: message.hasQuotedMsg,
      };

      // Add job to download queue with complete message data
      await this.queueService.addJobToDownloaderQueue(
        {
          url,
          messageData: messageData,
          userId,
          userNumber,
          timestamp: message.timestamp || Date.now()
        },
        {
          priority: 0,
          delay: 0,
        }
      );

      analyticsWrapper.trackDownloadEvent('requested', userId, {
        url,
        messageId: message.id._serialized
      });
      
      loggerService.info('Download request queued', {
        userId,
        url,
      });
    } catch (error) {
      analyticsWrapper.trackDownloadEvent('request_failed', userId, {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
}