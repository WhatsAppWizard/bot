
export interface IWhatsAppStats {
  isAuthenticated: boolean;
  unreadChats: number;
  lastMessageDate: Date | null;
  lastStickerDate: Date | null;
  lastDownloadDate: Date | null;
}
