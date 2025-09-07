import { Message } from 'whatsapp-web.js';

export interface IMessageHandler {
  canHandle(message: Message): Promise<boolean>;
  handle(message: Message, userId: string): Promise<void>;
}

export interface ICommandHandler extends IMessageHandler {
  getSupportedCommands(): string[];
}

export interface IMediaHandler extends IMessageHandler {
  getSupportedMimeTypes(): string[];
}

export interface ILinkHandler extends IMessageHandler {
  getSupportedDomains(): string[];
}
