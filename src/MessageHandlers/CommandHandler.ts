import { Message } from "whatsapp-web.js";
import analyticsWrapper from "../services/AnalyticsWrapper";
import loggerService from "../services/Logger";
import { ICommandHandler } from "../types/IMessageHandler";
import { MessageUtils } from "../utils/MessageUtils";

export class CommandHandler implements ICommandHandler {
  private readonly supportedCommands = [".", "/", "..", "hi", "هلا"];

  async canHandle(message: Message): Promise<boolean> {
    if (!message.body) return false;

    const command = message.body.toLowerCase().trim();
    return this.supportedCommands.includes(command);
  }

  async handle(message: Message, userId: string): Promise<void> {
    try {
      const startTime = Date.now();

      // Check if this is a group chat - if so, don't respond to commands
      const chatInfo = await message.getChat();
      if (chatInfo.isGroup) {
        loggerService.debug("Skipping command response in group chat", {
          userId,
          command: message.body,
          messageId: message.id._serialized,
        });
        return;
      }

      const response = `We temporarily stopped supporting sticker creation due to WhatsApp policy changes. \n Hi there! I'm WhatsApp Wizard.\nNow you can send me any link from ANY Website, and I will download it for you.\n `;
      const responseWithChannelInfo =
        MessageUtils.appendTelegramChannelInfo(response);

      await message.reply(responseWithChannelInfo);

      const processingTime = Date.now() - startTime;

      analyticsWrapper.trackMessageEvent("command_handled", userId, {
        command: message.body,
        processingTime,
        messageId: message.id._serialized,
      });

      loggerService.info("Command handled successfully", {
        userId,
        command: message.body,
        processingTime,
      });
    } catch (error) {
      loggerService.logError(error as Error, "CommandHandler.handle", {
        userId,
        command: message.body,
        messageId: message.id._serialized,
      });

      analyticsWrapper.trackErrorEvent(
        "command_handler_error",
        "CommandHandler",
        error
      );
    }
  }

  getSupportedCommands(): string[] {
    return [...this.supportedCommands];
  }
}
