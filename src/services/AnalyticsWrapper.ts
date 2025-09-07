import AnalyticsService from './Analytics';
import { IAnalyticsWrapper } from '../types/IAnalyticsWrapper';
import loggerService from './Logger';

class AnalyticsWrapper implements IAnalyticsWrapper {
  private readonly serviceName = 'whatsapp-bot';

  trackEvent(eventName: string, userId: string, properties?: any): void {
    try {
      AnalyticsService.trackEvent(eventName, userId, {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        ...properties
      });
      
      loggerService.debug('Analytics event tracked', {
        eventName,
        userId,
        properties
      });
    } catch (error) {
      loggerService.logError(error as Error, 'AnalyticsWrapper.trackEvent', {
        eventName,
        userId,
        properties
      });
    }
  }

  identifyUser(userId: string, traits: any): void {
    try {
      AnalyticsService.identifyUser(userId, {
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        ...traits
      });
      
      loggerService.debug('User identified in analytics', {
        userId,
        traits
      });
    } catch (error) {
      loggerService.logError(error as Error, 'AnalyticsWrapper.identifyUser', {
        userId,
        traits
      });
    }
  }

  trackWhatsAppEvent(eventType: string, data?: any): void {
    this.trackEvent('whatsapp_event', 'system', {
      event_type: eventType,
      ...data
    });
    
    loggerService.logWhatsAppEvent(eventType, data);
  }

  trackMessageEvent(eventType: string, userId: string, messageData: any): void {
    this.trackEvent('message_event', userId, {
      event_type: eventType,
      ...messageData
    });
    
    loggerService.logMessageProcessed(
      messageData.messageId || 'unknown',
      userId,
      messageData.processingTime || 0
    );
  }

  trackDownloadEvent(eventType: string, userId: string, downloadData: any): void {
    this.trackEvent('download_event', userId, {
      event_type: eventType,
      ...downloadData
    });
    
    loggerService.logDownloadEvent(eventType, downloadData.downloadId || 'unknown', downloadData);
  }

  trackErrorEvent(errorType: string, context: string, error: any): void {
    this.trackEvent('error_event', 'system', {
      error_type: errorType,
      context,
      error_message: error?.message || error,
      error_stack: error?.stack
    });
    
    loggerService.logError(
      error instanceof Error ? error : new Error(String(error)),
      context,
      { errorType }
    );
  }

  // Specific event tracking methods
  trackAuthenticationEvent(eventType: 'authenticated' | 'auth_failure' | 'disconnected' | 'ready'): void {
    this.trackWhatsAppEvent(`whatsapp_${eventType}`);
  }

  trackCallEvent(eventType: 'rejected' | 'received'): void {
    this.trackWhatsAppEvent(`call_${eventType}`);
  }

  trackQRCodeEvent(eventType: 'generated' | 'scanned' | 'cleared'): void {
    this.trackWhatsAppEvent(`qrcode_${eventType}`);
  }

  trackStickerEvent(eventType: 'created' | 'failed', userId: string, data?: any): void {
    this.trackEvent('sticker_event', userId, {
      event_type: eventType,
      ...data
    });
  }

  trackRateLimitEvent(userId: string, userNumber: string): void {
    this.trackEvent('rate_limited', userId, {
      user_number: userNumber
    });
  }
}

// Singleton instance
const analyticsWrapper = new AnalyticsWrapper();
export default analyticsWrapper;
