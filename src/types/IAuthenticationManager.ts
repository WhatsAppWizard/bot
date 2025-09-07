
export interface IAuthenticationManager {
  generateQRCode(qr: string): Promise<void>;
  clearQRCode(): Promise<void>;
  handleAuthentication(): void;
  handleAuthFailure(): void;
  handleDisconnection(reason: string): void;
  handleReady(): void;
}
