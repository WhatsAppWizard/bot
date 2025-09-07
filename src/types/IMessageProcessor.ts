import { Message } from 'whatsapp-web.js';


export interface IMessageProcessor {
  processMessage(message: Message): Promise<void>;
  processUnreadMessages(): Promise<void>;
}
