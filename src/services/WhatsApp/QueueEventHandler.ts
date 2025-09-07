import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import { DownloadEvents, DownloadJob } from '../../types/Download';
import { DownloadStatus } from '../../generated/prisma';
import DownloadRepository from '../Database/Downloads';
import ErrorsRepository from '../Database/Errors';
import FileService from '../Files';
import { shortenerService } from '../Shortener';
import loggerService from '../Logger';
import analyticsWrapper from '../AnalyticsWrapper';
import QueueService from '../Queue';

export interface IQueueEventHandler {
  setupEventHandlers(client: Client, queueService: QueueService): void;
  handleDownloadCompleted(job: DownloadJob, client: Client): Promise<void>;
  handleDownloadFailed(job: DownloadJob, error:  any, client: Client): Promise<void>;
}

class QueueEventHandler implements IQueueEventHandler {
  private readonly downloadRepository: DownloadRepository;
  private readonly errorsRepository: ErrorsRepository;

  constructor() {
    this.downloadRepository = new DownloadRepository();
    this.errorsRepository = new ErrorsRepository();
  }

  setupEventHandlers(client: Client, queueService: QueueService): void {
    queueService.on(
      DownloadEvents.DownloadCompleted,
      async (job: DownloadJob) => {
        await this.handleDownloadCompleted(job, client);
      }
    );

    queueService.on(
      DownloadEvents.DownloadFailed,
      async (job: DownloadJob, error: any) => {
        await this.handleDownloadFailed(job, error, client);
      }
    );

    loggerService.info('Queue event handlers setup completed');
  }

  async handleDownloadCompleted(job: DownloadJob, client: Client): Promise<void> {
    try {
      const { download, downloadId } = job.returnvalue;
      const { message } = job.data;

      for (const element of download) {
        const { path, platform } = element;

        // Get the message object
        const userMessageOnWhatsApp = await client.getMessageById(
          message.id._serialized
        );

        if (platform === "YouTube") {
          await this.handleYouTubeDownload(path, userMessageOnWhatsApp, message, client);
        } else {
          await this.handleMediaDownload(path, userMessageOnWhatsApp, message, client);
        }

        analyticsWrapper.trackDownloadEvent('response_sent', job.data.message.from, {
          platform,
          downloadId,
          messageId: message.id._serialized
        });
      }

      await this.downloadRepository.updateStatusById(
        downloadId,
        DownloadStatus.SENT
      );

      loggerService.logDownloadEvent('completed', downloadId, {
        platform: download[0]?.platform,
        messageId: message.id._serialized
      });

    } catch (error) {
      loggerService.logError(error as Error, 'QueueEventHandler.handleDownloadCompleted', {
        jobId: job.id,
        downloadId: job.data.downloadId
      });

      analyticsWrapper.trackErrorEvent('download_completion_error', 'QueueEventHandler', {
        error,
        job
      });
    }
  }

  async handleDownloadFailed(job: DownloadJob, error: any, client: Client): Promise<void> {
    try {
      const { message } = job.data;
      const userMessageOnWhatsApp = await client.getMessageById(
        message.id._serialized
      );

      const errorMessage = "Believe me, I tried my best to download this file, but something went error, don't worry i'm automatically reported it to Mahmoud and he will fix it soon. 🫠😔 \n\nPlease try again later";

      if (userMessageOnWhatsApp) {
        await userMessageOnWhatsApp.reply(errorMessage);
      } else {
        const chat = await client.getChatById(message.from);
        await chat.sendMessage(errorMessage);
      }

      // Log error to database
      await this.errorsRepository.createError(error.toString(), job.data.downloadId);

      analyticsWrapper.trackDownloadEvent('failed', job.data.message.from, {
        error: error.toString(),
        downloadId: job.data.downloadId,
        messageId: message.id._serialized
      });

      loggerService.logDownloadEvent('failed', job.data.downloadId, {
        error: error.toString(),
        messageId: message.id._serialized
      });

    } catch (errorFromFunction) {
      loggerService.logError(errorFromFunction as Error, 'QueueEventHandler.handleDownloadFailed', {
        originalError: error,
        jobId: job.id
      });
    }
  }

  private async handleYouTubeDownload(
    path: string, 
    userMessageOnWhatsApp: Message, 
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
        messageId: message.id._serialized
      });

    } catch (error) {
      loggerService.logError(error as Error, 'QueueEventHandler.handleYouTubeDownload', {
        originalUrl: path,
        messageId: message.id._serialized
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
    userMessageOnWhatsApp: Message, 
    message: any, 
    client: Client
  ): Promise<void> {
    try {
      const media = MessageMedia.fromFilePath(path);
      
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
        messageId: message.id._serialized
      });

    } catch (error) {
      loggerService.logError(error as Error, 'QueueEventHandler.handleMediaDownload', {
        filePath: path,
        messageId: message.id._serialized
      });
      
      // Try to clean up file even if sending failed
      try {
        await FileService.removeFile(path);
      } catch (cleanupError) {
        loggerService.logError(cleanupError as Error, 'QueueEventHandler.cleanupFile', {
          filePath: path
        });
      }
    }
  }
}

export default QueueEventHandler;
