import { Message } from 'whatsapp-web.js';
import { CommandHandler } from '../../MessageHandlers/CommandHandler';
import { LinkHandler } from '../../MessageHandlers/LinkHandler';
import { MediaHandler } from '../../MessageHandlers/MediaHandler';
import { TextHandler } from '../../MessageHandlers/TextHandler';
import { IMessageHandler } from '../../types/IMessageHandler';
import { IMessageProcessor } from '../../types/IMessageProcessor';
import analyticsWrapper from '../AnalyticsWrapper';
import UserRepository from '../Database/Users';
import loggerService from '../Logger';

class MessageProcessor implements IMessageProcessor {
  private readonly handlers: IMessageHandler[];
  private readonly userRepository: UserRepository;

  constructor() {
    this.handlers = [
      new CommandHandler(),
      new MediaHandler(),
      new LinkHandler(),
      new TextHandler()
    ];
    this.userRepository = new UserRepository();
  }

  async processMessage(message: Message): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!message) {
        loggerService.warn('Received null or undefined message');
        return;
      }

      const chatInfo = await message.getChat();
      if (!chatInfo) {
        loggerService.warn('Could not get chat info for message', {
          messageId: message.id._serialized
        });
        return;
      }

      // Skip read-only chats
      if (chatInfo.isReadOnly) {
        loggerService.debug('Skipping read-only chat message', {
          messageId: message.id._serialized,
          isReadOnly: chatInfo.isReadOnly
        });
        return;
      }

      // For group chats, only process links and media, skip text messages
      if (chatInfo.isGroup) {
        const hasLinks = message.links && message.links.length > 0;
        const hasMedia = message.hasMedia;
        
        if (!hasLinks && !hasMedia) {
          loggerService.debug('Skipping text message in group chat', {
            messageId: message.id._serialized,
            isGroup: chatInfo.isGroup
          });
          return;
        }
        if (hasMedia){
            loggerService.debug('Skipping media message in group chat', {
            messageId: message.id._serialized,
            isGroup: chatInfo.isGroup
          });
          return;
        }
        loggerService.debug('Processing link message in group chat', {
          messageId: message.id._serialized,
          isGroup: chatInfo.isGroup,
          hasLinks,
          hasMedia
        });
      }

      // Mark message as seen
      await chatInfo.sendSeen();

      // Get or create user
      const user = await this.getOrCreateUser(message);
      
      // Process message with appropriate handler
      await this.handleMessageWithHandlers(message, user.id);

      const processingTime = Date.now() - startTime;
      
      analyticsWrapper.trackMessageEvent('message_processed', user.id, {
        processingTime,
        messageId: message.id._serialized,
        hasMedia: message.hasMedia,
        hasLinks: message.links.length > 0
      });

      loggerService.logMessageProcessed(message.id._serialized, user.id, processingTime);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      loggerService.logError(error as Error, 'MessageProcessor.processMessage', {
        messageId: message.id._serialized,
        processingTime
      });
      
      analyticsWrapper.trackErrorEvent('message_processing_error', 'MessageProcessor', {
        error,
        messageId: message.id._serialized,
        processingTime
      });
    }
  }



  private async getOrCreateUser(message: Message): Promise<any> {
    try {
      const contactInfo = await message.getContact();
      const userNumber = await contactInfo.getFormattedNumber();
      const countryCode = userNumber.split(" ")[0];

      const userPayload = {
        name: contactInfo.pushname || userNumber,
        phone: userNumber,
        platform: message.deviceType,
        country: countryCode,
      };

      const user = await this.userRepository.createOrUpdateUser(userPayload);
      
      analyticsWrapper.identifyUser(user.id, {
        ...userPayload,
        firstSeen: new Date(),
      });

      analyticsWrapper.trackMessageEvent('user_identified', user.id, {
        has_media: message.hasMedia,
        has_links: message.links.length > 0,
        platform: message.deviceType,
      });

      return user;
    } catch (error) {
      loggerService.logError(error as Error, 'MessageProcessor.getOrCreateUser', {
        messageId: message.id._serialized
      });
      throw error;
    }
  }

  private async handleMessageWithHandlers(message: Message, userId: string): Promise<void> {
    for (const handler of this.handlers) {
      try {
        if (await handler.canHandle(message)) {
          await handler.handle(message, userId);
          break; // Only handle with the first matching handler
        }
      } catch (error) {
        loggerService.logError(error as Error, 'MessageProcessor.handleMessageWithHandlers', {
          handlerName: handler.constructor.name,
          messageId: message.id._serialized,
          userId
        });
        
        // Continue to next handler if current one fails
        continue;
      }
    }
  }
}

export default MessageProcessor;
