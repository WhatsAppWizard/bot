
export interface IAnalyticsWrapper {
  trackEvent(eventName: string, userId: string, properties?: any): void;
  identifyUser(userId: string, traits: any): void;
  trackWhatsAppEvent(eventType: string, data?: any): void;
  trackMessageEvent(eventType: string, userId: string, messageData: any): void;
  trackDownloadEvent(eventType: string, userId: string, downloadData: any): void;
  trackErrorEvent(errorType: string, context: string, error: any): void;
}
