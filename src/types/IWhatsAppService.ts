import { Client } from "whatsapp-web.js";
import { IWhatsAppStats } from "./IWhatsAppStats";


export interface IWhatsAppService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getClientStats(): IWhatsAppStats;
  isReady(): boolean;
  getClient(): Client | null;
}
