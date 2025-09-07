import QRCode from "qr-image";
import FileService from "../Files";
import ConfigService from "../Config";
import TelegramService from "../Telegram";
import loggerService from "../Logger";
import analyticsWrapper from "../AnalyticsWrapper";
import { IAuthenticationManager } from "../../types/IAuthenticationManager";

class AuthenticationManager implements IAuthenticationManager {
  private readonly qrCodePath: string;
  private readonly telegramService: TelegramService;

  constructor() {
    ConfigService.ensurePublicDirectoryExists();
    this.qrCodePath = ConfigService.getQrCodePath();
    this.telegramService = TelegramService.getInstance();
  }

  async generateQRCode(qr: string): Promise<void> {
    try {
      const QR: Buffer = QRCode.imageSync(qr, { type: "png" }) as Buffer;
      await FileService.saveFile(this.qrCodePath, QR);

      if (this.telegramService.QrCodeMessageId) {
        await this.telegramService.updateQRCode(
          this.qrCodePath,
          this.telegramService.QrCodeMessageId
        );
      } else {
        this.telegramService.QrCodeMessageId =
          (await this.telegramService.sendQRcode(this.qrCodePath)) as number;
      }

      analyticsWrapper.trackQRCodeEvent('generated');
      
      loggerService.info('QR code generated and sent to Telegram', {
        qrCodePath: this.qrCodePath,
        messageId: this.telegramService.QrCodeMessageId
      });

    } catch (error) {
      loggerService.logError(error as Error, 'AuthenticationManager.generateQRCode', {
        qrCodePath: this.qrCodePath
      });
      
      analyticsWrapper.trackErrorEvent('qr_generation_error', 'AuthenticationManager', error);
    }
  }

  async clearQRCode(): Promise<void> {
    try {
      await FileService.removeFile(this.qrCodePath);
      
      analyticsWrapper.trackQRCodeEvent('cleared');
      
      loggerService.info('QR code cleared', {
        qrCodePath: this.qrCodePath
      });
    } catch (error) {
      loggerService.logError(error as Error, 'AuthenticationManager.clearQRCode', {
        qrCodePath: this.qrCodePath
      });
    }
  }

  handleAuthentication(): void {
    try {
      analyticsWrapper.trackAuthenticationEvent('authenticated');
      
      this.telegramService.sendMessage(
        "WhatsApp is authenticated and ready to go!"
      );

      loggerService.logWhatsAppEvent('authenticated', {});
    } catch (error) {
      loggerService.logError(error as Error, 'AuthenticationManager.handleAuthentication');
    }
  }

  handleAuthFailure(): void {
    try {
      analyticsWrapper.trackAuthenticationEvent('auth_failure');
      
      this.telegramService.sendMessage(
        "WhatsApp authentication failed. Please re-scan the QR code."
      );

      loggerService.logWhatsAppEvent('auth_failure', {});
    } catch (error) {
      loggerService.logError(error as Error, 'AuthenticationManager.handleAuthFailure');
    }
  }

  handleDisconnection(reason: string): void {
    try {
      analyticsWrapper.trackAuthenticationEvent('disconnected');
      
      this.telegramService.sendMessage(
        "WhatsApp client was disconnected. Please re-scan the QR code."
      );

      loggerService.logWhatsAppEvent('disconnected', { reason });
    } catch (error) {
      loggerService.logError(error as Error, 'AuthenticationManager.handleDisconnection', {
        reason
      });
    }
  }

  handleReady(): void {
    try {
      analyticsWrapper.trackAuthenticationEvent('ready');
      
      this.telegramService.sendMessage("WhatsApp client is ready!");

      // Clean up QR code if authentication was completed
      if (this.telegramService.QrCodeMessageId) {
        this.telegramService.deleteMessage(
          this.telegramService.QrCodeMessageId
        );
        this.telegramService.QrCodeMessageId = null;
        this.clearQRCode();
        
        analyticsWrapper.trackQRCodeEvent('scanned');
      }

      // Send QR code screenshot to Telegram
      this.telegramService.sendQRcode(this.qrCodePath);

      loggerService.logWhatsAppEvent('ready', {});
    } catch (error) {
      loggerService.logError(error as Error, 'AuthenticationManager.handleReady');
    }
  }
}

export default AuthenticationManager;
