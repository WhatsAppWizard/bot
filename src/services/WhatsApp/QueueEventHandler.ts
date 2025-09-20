import { downloadService } from './../Download';
import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import { DownloadEvents } from '../../types/Download';
import { DownloadStatus } from '../../generated/prisma';
import DownloadRepository from '../Database/Downloads';
import ErrorsRepository from '../Database/Errors';
import UserRepository from '../Database/Users';
import FileService from '../Files';
import { shortenerService } from '../Shortener';
import loggerService from '../Logger';
import analyticsWrapper from '../AnalyticsWrapper';
import QueueService from '../Queue';

export interface IQueueEventHandler {
  setupEventHandlers(client: Client, queueService: QueueService): void;
  handleStreamDownloadCompleted(eventData: any, client: Client): Promise<void>;
  handleStreamDownloadFailed(eventData: any, client: Client): Promise<void>;
}

class QueueEventHandler implements IQueueEventHandler {
  private readonly downloadRepository: DownloadRepository;
  private readonly errorsRepository: ErrorsRepository;
  private readonly userRepository: UserRepository;
  private readonly downloadService: typeof downloadService;

  constructor() {
    this.downloadRepository = new DownloadRepository();
    this.errorsRepository = new ErrorsRepository();
    this.userRepository = new UserRepository();
    this.downloadService = downloadService;
  }

  setupEventHandlers(client: Client, queueService: QueueService): void {
    // Stream event handlers
    queueService.on(
      DownloadEvents.DownloadCompleted,
      async (eventData: any) => {
        await this.handleStreamDownloadCompleted(eventData, client);
      }
    );

    queueService.on(
      DownloadEvents.DownloadFailed,
      async (eventData: any) => {
        await this.handleStreamDownloadFailed(eventData, client);
      }
    );

    loggerService.info('Stream event handlers setup completed');
  }

  // Helper method to get user ID from phone number
  private async getUserIdFromPhone(phone: string): Promise<string | null> {
    try {
      const user = await this.userRepository.getUserByPhone(phone);
      return user?.id || null;
    } catch (error) {
      loggerService.logError(error as Error, 'QueueEventHandler.getUserIdFromPhone', { phone });
      return null;
    }
  }

  async handleStreamDownloadCompleted(eventData: {
    jobId: string;
    userId?: string;
    url?: string;
    downloadUrl?: string;
    detectedPlatform?: string | null;
    usedProvider?: string;
    messageData?: any;
    timestamp?: string;
  }, client: Client): Promise<void> {
    try {
      const { jobId, downloadUrl, detectedPlatform, messageData, url } = eventData;

      if (!messageData) {
        loggerService.warn("No message data in stream event", { jobId });
        return;
      }

      // Get the message object using the message ID
      const userMessageOnWhatsApp = await client.getMessageById(messageData.id);

      // Check if the downloadUrl is Array, if it is, then we need to loop through the array and download all the urls
      // the array is sent as string , so we need to convert it to an array [\""]

      const downloadUrls = JSON.parse(downloadUrl || '[]');
      if (Array.isArray(downloadUrls)) {
        for (const url of downloadUrls) {
          const downloaded = await this.downloadService.DownloadOnDisk(url, detectedPlatform || '');
          await this.handleMediaDownload(downloaded.path, userMessageOnWhatsApp, messageData, client);
        }
      } else {
        const downloaded = await this.downloadService.DownloadOnDisk(downloadUrls || '', detectedPlatform || '');
        await this.handleMediaDownload(downloaded.path, userMessageOnWhatsApp, messageData, client);
      }



      // Get user ID from phone number
      const userId = await this.getUserIdFromPhone(messageData.from);
      if (!userId) {
        loggerService.warn("User not found in database", { phone: messageData.from, jobId });
        return;
      }

      // Record successful download in database AFTER handling
      await this.downloadRepository.create(
        url || '',
        detectedPlatform || 'unknown',
        userId,
        BigInt(Date.now()),
        DownloadStatus.SENT
      );

      analyticsWrapper.trackDownloadEvent('response_sent', messageData.from, {
        platform: detectedPlatform,
        downloadId: jobId,
        messageId: messageData.id
      });

      loggerService.logDownloadEvent('completed', jobId, {
        platform: detectedPlatform,
        messageId: messageData.id
      });

    } catch (error) {
      // Record failed download in database AFTER handling fails
      if (eventData.messageData) {
        try {
          const userId = await this.getUserIdFromPhone(eventData.messageData.from);
          if (userId) {
            await this.downloadRepository.create(
              eventData.url || '',
              eventData.detectedPlatform || 'unknown',
              userId,
              BigInt(Date.now()),
              DownloadStatus.FAILED
            );
          } else {
            loggerService.warn("User not found for failed download record", { phone: eventData.messageData.from, jobId: eventData.jobId });
          }
        } catch (dbError) {
          loggerService.logError(dbError as Error, 'QueueEventHandler.createFailedDownloadRecord');
        }
      }

      loggerService.logError(error as Error, 'QueueEventHandler.handleStreamDownloadCompleted', {
        jobId: eventData.jobId
      });

      analyticsWrapper.trackErrorEvent('stream_download_completion_error', 'QueueEventHandler', {
        error,
        eventData
      });
    }
  }

  async handleStreamDownloadFailed(eventData: {
    jobId: string;
    userId?: string;
    url?: string;
    errorMessage?: string;
    errorCode?: string;
    detectedPlatform?: string | null;
    messageData?: any;
    timestamp?: string;
  }, client: Client): Promise<void> {
    try {
      const { jobId, errorMessage, messageData, url, detectedPlatform } = eventData;

      if (!messageData) {
        loggerService.warn("No message data in stream event", { jobId });
        return;
      }

      const userMessageOnWhatsApp = await client.getMessageById(messageData.id);

      const errorMsg = "Believe me, I tried my best to download this file, but something went error, don't worry i'm automatically reported it to Mahmoud and he will fix it soon. 🫠😔 \n\nPlease try again later";

      if (userMessageOnWhatsApp) {
        await userMessageOnWhatsApp.reply(errorMsg);
      } else {
        const chat = await client.getChatById(messageData.from);
        await chat.sendMessage(errorMsg);
      }

      // Get user ID from phone number
      const userId = await this.getUserIdFromPhone(messageData.from);
      if (!userId) {
        loggerService.warn("User not found in database", { phone: messageData.from, jobId });
        return;
      }

      // Record failed download in database AFTER handling
      await this.downloadRepository.create(
        url || '',
        detectedPlatform || 'unknown',
        userId,
        BigInt(Date.now()),
        DownloadStatus.FAILED
      );

      // Log error to database
      await this.errorsRepository.createError(errorMessage || 'Unknown error', jobId);

      analyticsWrapper.trackDownloadEvent('failed', messageData.from, {
        error: errorMessage,
        downloadId: jobId,
        messageId: messageData.id
      });

      loggerService.logDownloadEvent('failed', jobId, {
        error: errorMessage,
        messageId: messageData.id
      });

    } catch (errorFromFunction) {
      // Record failed download in database even if error handling fails
      if (eventData.messageData) {
        try {
          const userId = await this.getUserIdFromPhone(eventData.messageData.from);
          if (userId) {
            await this.downloadRepository.create(
              eventData.url || '',
              eventData.detectedPlatform || 'unknown',
              userId,
              BigInt(Date.now()),
              DownloadStatus.FAILED
            );
          } else {
            loggerService.warn("User not found for failed download record", { phone: eventData.messageData.from, jobId: eventData.jobId });
          }
        } catch (dbError) {
          loggerService.logError(dbError as Error, 'QueueEventHandler.createFailedDownloadRecord');
        }
      }

      loggerService.logError(errorFromFunction as Error, 'QueueEventHandler.handleStreamDownloadFailed', {
        originalError: eventData.errorMessage,
        jobId: eventData.jobId
      });
    }
  }

  private async handleYouTubeDownload(
    path: string, 
    userMessageOnWhatsApp: Message | null, 
    message: any, 
    client: Client
  ): Promise<void> {
    try {
      const shortenedUrl = await shortenerService.shortenUrl(path);
      const messageText = `Here's your YouTube video URL:\n ${shortenedUrl} \n Be Advised this is a Temporary fix`;

      if (!userMessageOnWhatsApp) {
        const chat = await client.getChatById(message.from);
        await chat.sendMessage(messageText);
      } else {
        await userMessageOnWhatsApp.reply(messageText);
      }

      loggerService.info('YouTube URL sent successfully', {
        originalUrl: path,
        shortenedUrl,
        messageId: message.id
      });

    } catch (error) {
      loggerService.logError(error as Error, 'QueueEventHandler.handleYouTubeDownload', {
        originalUrl: path,
        messageId: message.id
      });

      // Fallback to original URL
      const fallbackMessage = `Here's your YouTube video URL:\n${path}`;
      
      if (!userMessageOnWhatsApp) {
        const chat = await client.getChatById(message.from);
        await chat.sendMessage(fallbackMessage);
      } else {
        await userMessageOnWhatsApp.reply(fallbackMessage);
      }
    }
  }

  private async handleMediaDownload(
    path: string, 
    userMessageOnWhatsApp: Message | null, 
    message: any, 
    client: Client
  ): Promise<void> {
    try {
      const media =  MessageMedia.fromFilePath(path);
      
      if (!userMessageOnWhatsApp) {
        const chat = await client.getChatById(message.from);
        await chat.sendMessage(media);
      } else {
        await userMessageOnWhatsApp.reply(media);
      }

      // Clean up file after sending
      await FileService.removeFile(path);

      loggerService.info('Media file sent successfully', {
        filePath: path,
        messageId: message.id
      });

    } catch (error) {
      loggerService.logError(error as Error, 'QueueEventHandler.handleMediaDownload', {
        filePath: path,
        messageId: message.id
      });
      
    
    }
  }
}

export default QueueEventHandler;