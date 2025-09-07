import { Client } from "whatsapp-web.js";
import { IWhatsAppStats } from "./StatsService";


export interface IWhatsAppService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getClientStats(): IWhatsAppStats;
  isReady(): boolean;
  getClient(): Client | null;
}
