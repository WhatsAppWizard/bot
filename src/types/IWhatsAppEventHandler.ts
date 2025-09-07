import { Client } from 'whatsapp-web.js';


export interface IWhatsAppEventHandler {
  setupEventHandlers(client: Client): void;
  handleCall(call: any): Promise<void>;
  setupTelegramEvents(): void;
  setupQueueEvents(): void;
}
