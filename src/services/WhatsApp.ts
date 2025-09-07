import puppeteer from "puppeteer-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import { Client, LocalAuth } from "whatsapp-web.js";
import ConfigService from "./Config";
import WhatsAppEventHandler from "./WhatsApp/WhatsAppEventHandler";
import StatsService from "./StatsService";
import { IWhatsAppStats } from "../types/IWhatsAppStats";
import loggerService from "./Logger";
import analyticsWrapper from "./AnalyticsWrapper";
import { IWhatsAppService } from "../types/IWhatsAppService";

class WhatsAppService implements IWhatsAppService {
  private client: Client | null = null;
  private readonly eventHandler: WhatsAppEventHandler;
  private readonly statsService: StatsService;
  private isInitialized: boolean = false;

  constructor() {
    this.eventHandler = new WhatsAppEventHandler();
    this.statsService = new StatsService();
  }

  async start(): Promise<void> {
    try {
      loggerService.info("Starting WhatsApp service...");

      await this.initialize();

      this.isInitialized = true;

      loggerService.info("WhatsApp service started successfully");
      analyticsWrapper.trackWhatsAppEvent("service_started");
    } catch (error) {
      loggerService.logError(error as Error, "WhatsAppService.start");
      analyticsWrapper.trackErrorEvent(
        "service_start_error",
        "WhatsAppService",
        error
      );
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      loggerService.info("Stopping WhatsApp service...");

      this.statsService.stopUnreadChatMonitoring();

      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }

      this.isInitialized = false;

      loggerService.info("WhatsApp service stopped successfully");
      analyticsWrapper.trackWhatsAppEvent("service_stopped");
    } catch (error) {
      loggerService.logError(error as Error, "WhatsAppService.stop");
      analyticsWrapper.trackErrorEvent(
        "service_stop_error",
        "WhatsAppService",
        error
      );
    }
  }

  getClientStats(): IWhatsAppStats {
    return this.statsService.getStats();
  }

  isReady(): boolean {
    return (
      this.isInitialized &&
      this.client !== null &&
      this.statsService.getStats().isAuthenticated
    );
  }

  getClient(): Client | null {
    return this.client;
  }

  private async initialize(): Promise<void> {
    puppeteer.use(stealth());
  

    // Create WhatsApp client
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        ...ConfigService.getPuppeteerOptions(),
        headless: false,
      },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3029.110 Safari/537.3",
    });

    loggerService.info("WhatsApp client created successfully");

    try {
      await this.client.initialize();

      // Setup event handlers
      this.setupEventHandlers();

      loggerService.info("WhatsApp client initialized successfully");
    } catch (error) {
      loggerService.logError(error as Error, "WhatsAppService.initialize");
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    try {
      // Setup WhatsApp event handlers
      this.eventHandler.setupEventHandlers(this.client);

      // Setup queue events with client instance
      this.eventHandler.setupQueueEventsWithClient(this.client);

      // Start unread chat monitoring
      this.statsService.startUnreadChatMonitoring(this.client);

      loggerService.info("Event handlers setup completed");
    } catch (error) {
      loggerService.logError(
        error as Error,
        "WhatsAppService.setupEventHandlers"
      );
      throw error;
    }
  }

  // Public methods for external access
  public async sendMessage(chatId: string, message: string): Promise<void> {
    if (!this.client || !this.isReady()) {
      throw new Error("WhatsApp client is not ready");
    }

    try {
      const chat = await this.client.getChatById(chatId);
      await chat.sendMessage(message);

      loggerService.info("Message sent successfully", {
        chatId,
        messageLength: message.length,
      });
    } catch (error) {
      loggerService.logError(error as Error, "WhatsAppService.sendMessage", {
        chatId,
        messageLength: message.length,
      });
      throw error;
    }
  }

  public async getChats(): Promise<any[]> {
    if (!this.client || !this.isReady()) {
      throw new Error("WhatsApp client is not ready");
    }

    try {
      const chats = await this.client.getChats();

      loggerService.debug("Chats retrieved", {
        chatCount: chats.length,
      });

      return chats;
    } catch (error) {
      loggerService.logError(error as Error, "WhatsAppService.getChats");
      throw error;
    }
  }

  public async getUnreadChats(): Promise<number> {
    if (!this.client || !this.isReady()) {
      throw new Error("WhatsApp client is not ready");
    }

    try {
      return await this.statsService.getUnreadChats(this.client);
    } catch (error) {
      loggerService.logError(error as Error, "WhatsAppService.getUnreadChats");
      throw error;
    }
  }
}

export default WhatsAppService;
