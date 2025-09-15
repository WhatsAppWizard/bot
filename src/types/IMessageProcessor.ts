import { Message } from 'whatsapp-web.js';


export interface IMessageProcessor {
  processMessage(message: Message, botId:string): Promise<void>;
}
