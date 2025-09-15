import { createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import ConfigService from './Config';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface ILogger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

class LoggerService implements ILogger {
  private logger: any;

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger() {
    const lokiConfig = ConfigService.getLokiConfig();
    const lokiTransport = new LokiTransport({
      host: lokiConfig.host,
      labels: {
        service: 'whatsapp-wizard',
        environment: ConfigService.getEnv(),
        version: process.env.APP_VERSION || '1.2.0'
      },
      json: true,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
        format((info) => {
          // Extract labels from meta and add to Loki labels
          if (info.labels) {
            Object.assign(info, info.labels);
          }
          return info;
        })()
      ),
      onConnectionError: (err: any) => console.error('Loki connection error:', err),
      basicAuth: `${lokiConfig.username}:${lokiConfig.password}`
    });

    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        // Console transport for development
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        // File transport for persistence
        new transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: format.combine(
            format.timestamp(),
            format.json()
          )
        }),
        new transports.File({
          filename: 'logs/combined.log',
          format: format.combine(
            format.timestamp(),
            format.json()
          )
        }),
        // Loki transport for Grafana
        lokiTransport
      ],
      exceptionHandlers: [
        new transports.File({ filename: 'logs/exceptions.log' })
      ],
      rejectionHandlers: [
        new transports.File({ filename: 'logs/rejections.log' })
      ]
    });
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, { 
      ...meta,
      labels: { 
        level: 'error',
        context: meta?.context || 'unknown',
        userId: meta?.userId || 'system',
        ...meta?.labels 
      }
    });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, { 
      ...meta,
      labels: { 
        level: 'warn',
        context: meta?.context || 'unknown',
        userId: meta?.userId || 'system',
        ...meta?.labels 
      }
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, { 
      ...meta,
      labels: { 
        level: 'info',
        context: meta?.context || 'unknown',
        userId: meta?.userId || 'system',
        ...meta?.labels 
      }
    });
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, { 
      ...meta,
      labels: { 
        level: 'debug',
        context: meta?.context || 'unknown',
        userId: meta?.userId || 'system',
        ...meta?.labels 
      }
    });
  }

  // Structured logging methods for specific events
  logWhatsAppEvent(event: string, data: any): void {
    this.info(`WhatsApp Event: ${event}`, {
      event,
      timestamp: new Date().toISOString(),
      ...data,
      labels: {
        level: 'info',
        context: 'whatsapp',
        event: event,
        userId: data.userId || 'system'
      }
    });
  }

  logMessageProcessed(messageId: string, userId: string, processingTime: number): void {
    this.info('Message processed', {
      messageId,
      userId,
      processingTime,
      timestamp: new Date().toISOString(),
      labels: {
        level: 'info',
        context: 'message_handler',
        userId: userId,
        messageId: messageId
      }
    });
  }

  logDownloadEvent(event: string, downloadId: string, data: any): void {
    this.info(`Download Event: ${event}`, {
      event,
      downloadId,
      timestamp: new Date().toISOString(),
      ...data,
      labels: {
        level: 'info',
        context: 'download',
        event: event,
        downloadId: downloadId,
        userId: data.userId || 'system'
      }
    });
  }

  logError(error: Error, context: string, meta?: any): void {
    this.error(`Error in ${context}`, {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      ...meta,
      labels: {
        level: 'error',
        context: context,
        userId: meta?.userId || 'system',
        errorType: error.name || 'Error'
      }
    });
  }
}

// Singleton instance
const loggerService = new LoggerService();
export default loggerService;
