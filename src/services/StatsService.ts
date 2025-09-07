import { Client } from 'whatsapp-web.js';
import TelegramService from './Telegram';
import loggerService from './Logger';
import analyticsWrapper from './AnalyticsWrapper';
import { IStatsService } from '../types/IStatsService';
import { IWhatsAppStats } from '../types/IWhatsAppStats';

class StatsService implements IStatsService {
  private readonly stats: IWhatsAppStats = {
    isAuthenticated: false,
    unreadChats: 0,
    lastMessageDate: null,
    lastStickerDate: null,
    lastDownloadDate: null,
  };

  private unreadChatInterval: NodeJS.Timeout | null = null;
  private readonly telegramService: TelegramService;

  constructor() {
    this.telegramService = TelegramService.getInstance();
  }

  getStats(): IWhatsAppStats {
    return { ...this.stats };
  }

  updateStats(updates: Partial<IWhatsAppStats>): void {
    Object.assign(this.stats, updates);
    
    loggerService.debug('Stats updated', {
      updates,
      currentStats: this.stats
    });
  }

  async getUnreadChats(client: Client): Promise<number> {
    try {
      let totalUnreadMessages = 0;
      const chats = await client.getChats();
      
      for (const chat of chats) {
        if (!chat.isGroup && !chat.isReadOnly) {
          const unreadCount = chat.unreadCount || 0;
          totalUnreadMessages += unreadCount;
        }
      }
      
      this.updateStats({ unreadChats: totalUnreadMessages });
      
      loggerService.debug('Unread chats counted', {
        totalUnreadMessages,
        totalChats: chats.length
      });
      
      return totalUnreadMessages;
    } catch (error) {
      loggerService.logError(error as Error, 'StatsService.getUnreadChats');
      analyticsWrapper.trackErrorEvent('unread_chats_error', 'StatsService', error);
      
      this.telegramService.sendMessage(
        "Error checking unread messages: " + error
      );
      
      throw error;
    }
  }

  startUnreadChatMonitoring(client: Client): void {
    if (this.unreadChatInterval) {
      this.stopUnreadChatMonitoring();
    }

    // Initial check
    this.getUnreadChats(client).catch(error => {
      loggerService.logError(error as Error, 'StatsService.initialUnreadCheck');
    });

    // Set up interval for monitoring
    this.unreadChatInterval = setInterval(async () => {
      if (this.stats.isAuthenticated) {
        try {
          await this.getUnreadChats(client);
        } catch (error) {
          loggerService.logError(error as Error, 'StatsService.unreadChatMonitoring');
        }
      }
    }, 5000); // Check every 5 seconds

    loggerService.info('Unread chat monitoring started');
  }

  stopUnreadChatMonitoring(): void {
    if (this.unreadChatInterval) {
      clearInterval(this.unreadChatInterval);
      this.unreadChatInterval = null;
      loggerService.info('Unread chat monitoring stopped');
    }
  }

  // Specific stat update methods
  updateAuthenticationStatus(isAuthenticated: boolean): void {
    this.updateStats({ isAuthenticated });
    
    analyticsWrapper.trackWhatsAppEvent(
      isAuthenticated ? 'authenticated' : 'disconnected'
    );
  }

  updateLastMessageDate(timestamp: number): void {
    const date = new Date(timestamp * 1000);
    this.updateStats({ lastMessageDate: date });
    
    loggerService.debug('Last message date updated', {
      timestamp,
      date: date.toISOString()
    });
  }

  updateLastStickerDate(timestamp: number): void {
    const date = new Date(timestamp * 1000);
    this.updateStats({ lastStickerDate: date });
    
    loggerService.debug('Last sticker date updated', {
      timestamp,
      date: date.toISOString()
    });
  }

  updateLastDownloadDate(): void {
    const date = new Date();
    this.updateStats({ lastDownloadDate: date });
    
    loggerService.debug('Last download date updated', {
      date: date.toISOString()
    });
  }
}

export default StatsService;
