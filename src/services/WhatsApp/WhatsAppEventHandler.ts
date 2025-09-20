import { Client } from 'whatsapp-web.js';
import AuthenticationManager from './AuthenticationManager';
import MessageProcessor from './MessageProcessor';
import QueueEventHandler from './QueueEventHandler';
import QueueService from '../Queue';
import TelegramService from '../Telegram';
import DownloadQueueListener from '../DownloadQueueListener';
import loggerService from '../Logger';
import analyticsWrapper from '../AnalyticsWrapper';
import { IWhatsAppEventHandler } from '../../types/IWhatsAppEventHandler';

class WhatsAppEventHandler implements IWhatsAppEventHandler {
  private readonly authenticationManager: AuthenticationManager;
  private readonly messageProcessor: MessageProcessor;
  private readonly queueEventHandler: QueueEventHandler;
  private readonly queueService: QueueService;
  private readonly telegramService: TelegramService;
  private readonly downloadQueueListener: DownloadQueueListener;

  constructor() {
    this.authenticationManager = new AuthenticationManager();
    this.messageProcessor = new MessageProcessor();
    this.queueEventHandler = new QueueEventHandler();
    this.queueService = QueueService.getInstance();
    this.telegramService = TelegramService.getInstance();
    this.downloadQueueListener = new DownloadQueueListener();
  }

  setupEventHandlers(client: Client): void {
    // Authentication events
    client.on("authenticated", () => {
      this.authenticationManager.handleAuthentication();
    });

    client.on("auth_failure", () => {
      this.authenticationManager.handleAuthFailure();
    });

    client.on("disconnected", (reason) => {
      this.authenticationManager.handleDisconnection(reason);
    });

    client.once("ready", async () => {
      this.authenticationManager.handleReady();
      
      // Setup message handling
      await this.setupMessageHandling(client);
      
      // Setup other event handlers
      this.setupCallHandling(client);
      this.setupTelegramEvents();
      this.setupQueueEventsWithClient(client);
      
      // Start download queue listener ONLY after WhatsApp is ready
      await this.startDownloadQueueListener();
    });

    // QR code generation
    client.on("qr", async (qr) => {
      await this.authenticationManager.generateQRCode(qr);
    });

    loggerService.info('WhatsApp event handlers setup completed');
  }

  private async setupMessageHandling(client: Client): Promise<void> {
    try {
      // Process unread messages first
      await this.processUnreadMessages(client);
      
      // Setup message event listener
      client.on("message", async (message) => {
        await this.messageProcessor.processMessage(message, client.info.wid._serialized);
      });

      loggerService.info('Message handling setup completed');
    } catch (error) {
      loggerService.logError(error as Error, 'WhatsAppEventHandler.setupMessageHandling');
    }
  }

  private async processUnreadMessages(client: Client): Promise<void> {
    try {
      const chats = await client.getChats();
      if (!chats || chats.length === 0) return;
      
      loggerService.info(`Found ${chats.length} chats. Processing unread messages...`);
      
      for (const chat of chats) {
        if (!chat) continue;
        if (!chat.isGroup && !chat.isReadOnly && chat.unreadCount > 0) {
          const messages = await chat.fetchMessages({
            limit: chat.unreadCount,
          });
          for (const message of messages) {
            if (!message.fromMe) {
              await this.messageProcessor.processMessage(message, client.info.wid._serialized);
            }
          }
        }
      }
      
      loggerService.info('Processed all unread messages');
    } catch (error) {
      loggerService.logError(error as Error, 'WhatsAppEventHandler.processUnreadMessages');
      analyticsWrapper.trackErrorEvent('unread_messages_error', 'WhatsAppEventHandler', error);
      
      this.telegramService.sendMessage(
        "Error processing unread messages: " + error
      );
    }
  }

  private setupCallHandling(client: Client): void {
    client.on("call", async (call) => {
      await this.handleCall(call);
    });
  }

  async handleCall(call: any): Promise<void> {
    try {
      call.reject();
      
      analyticsWrapper.trackCallEvent('rejected');
      
      await this.telegramService.sendMessage(
        `Call from ${call.from} rejected.`
      );

      const userId = call.from;
      if (!userId) return;
      
      const user = await call.client.getContactById(userId);
      const chat = await user.getChat();
      
      await chat.sendMessage(
        "You're Blocked due to spammy behavior. \n\nPlease contact us on our website to unblock you."
      );

      await user.block();

      loggerService.info('Call rejected and user blocked', {
        userId,
        callFrom: call.from
      });
    } catch (error) {
      loggerService.logError(error as Error, 'WhatsAppEventHandler.handleCall', {
        callFrom: call.from
      });
    }
  }

  setupTelegramEvents(): void {
    this.telegramService.on("broadcast-requested", async (message) => {
      try {
        loggerService.info('Broadcast message received', { message });
        
        // This would need access to the client instance
        // We'll handle this in the main service
        loggerService.info('Broadcast handling delegated to main service');
      } catch (error) {
        loggerService.logError(error as Error, 'WhatsAppEventHandler.setupTelegramEvents');
      }
    });
  }

  setupQueueEvents(): void {
    // Queue events will be setup when we have the client instance
    loggerService.info('Queue events setup delegated to main service');
  }

  // Setup queue events with client instance
  setupQueueEventsWithClient(client: Client): void {
    this.queueEventHandler.setupEventHandlers(client, this.queueService);
  }

  // Start download queue listener after WhatsApp is ready
  private async startDownloadQueueListener(): Promise<void> {
    try {
      await this.downloadQueueListener.start();
      loggerService.info('Download queue listener started after WhatsApp authentication');
    } catch (error) {
      loggerService.logError(error as Error, 'WhatsAppEventHandler.startDownloadQueueListener');
      throw error;
    }
  }

  // Stop download queue listener
  async stopDownloadQueueListener(): Promise<void> {
    try {
      await this.downloadQueueListener.stop();
      loggerService.info('Download queue listener stopped');
    } catch (error) {
      loggerService.logError(error as Error, 'WhatsAppEventHandler.stopDownloadQueueListener');
    }
  }

  // Method to handle broadcast with client instance
  async handleBroadcast(client: Client, message: string): Promise<void> {
    try {
      let count = 0;
      const chats = await client.getChats();
      
      for (const chat of chats) {
        count++;
        if (!chat.isGroup) {
          await chat.sendMessage(message);
        }
      }
      
      loggerService.info(`Broadcast message sent to ${count} chats`);
      
      this.telegramService.sendMessage(
        `Broadcast message sent to ${count} chats.`
      );
    } catch (error) {
      loggerService.logError(error as Error, 'WhatsAppEventHandler.handleBroadcast', {
        message
      });
    }
  }
}

export default WhatsAppEventHandler;