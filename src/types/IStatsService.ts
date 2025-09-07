import { Client } from 'whatsapp-web.js';
import { IWhatsAppStats } from '../types/IWhatsAppStats';


export interface IStatsService {
  getStats(): IWhatsAppStats;
  updateStats(updates: Partial<IWhatsAppStats>): void;
  getUnreadChats(client: Client): Promise<number>;
  startUnreadChatMonitoring(client: Client): void;
  stopUnreadChatMonitoring(): void;
}
