import { Message } from 'whatsapp-web.js';
import { IMessageHandler } from '../types/IMessageHandler';
import { AgentService } from '../services/Agent';
import loggerService from '../services/Logger';
import analyticsWrapper from '../services/AnalyticsWrapper';

export class TextHandler implements IMessageHandler {
  private readonly agentService: AgentService;

  constructor() {
    this.agentService = new AgentService();
  }

  async canHandle(message: Message): Promise<boolean> {
    return !message.hasMedia && 
           message.links.length === 0 && 
           Boolean(message.body) && 
           message.body.length > 2;
  }

  async handle(message: Message, userId: string): Promise<void> {
    try {
      const startTime = Date.now();
      const chatInfo = await message.getChat();
      
      if (!message.body) {
        return;
      }

      // Check if this is a group chat - if so, don't respond to text messages
      if (chatInfo.isGroup) {
        loggerService.debug('Skipping text response in group chat', {
          userId,
          messageId: message.id._serialized,
          messageLength: message.body.length
        });
        return;
      }

      const response = await this.agentService.sendMessage(message.body, userId);
      await message.reply(response);

      const processingTime = Date.now() - startTime;
      
      analyticsWrapper.trackMessageEvent('text_handled', userId, {
        messageLength: message.body.length,
        processingTime,
        messageId: message.id._serialized
      });
      
      loggerService.info('Text message handled successfully', {
        userId,
        messageLength: message.body.length,
        processingTime
      });
    } catch (error) {
      loggerService.logError(error as Error, 'TextHandler.handle', {
        userId,
        messageId: message.id._serialized
      });
      
      analyticsWrapper.trackErrorEvent('text_handler_error', 'TextHandler', error);
      
      try {
      const chatInfo = await message.getChat();

        // Only send error reply if not in group chat
        if (!chatInfo.isGroup) {
          await message.reply("Sorry, I'm having trouble processing your message right now. Please try again later.");
        }
      } catch (replyError) {
        loggerService.logError(replyError as Error, 'TextHandler.fallbackReply', {
          userId,
          originalError: error
        });
      }
    }
  }
}
