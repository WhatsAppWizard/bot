import { Client, LocalAuth } from "whatsapp-web.js";

import fs from "fs";
import path from "path";
import QRCode from "qr-image";
import SocketHandler from "./SocketHandler";

class WhatsApp {
  private client: Client;
  private qrCodePath: string;
  private socketHandler: SocketHandler;
  public isAuthenticated: boolean = false;
  public unreadChats: number = 0;

  constructor() {
    this.client = new Client({
      puppeteer: {
        headless: false,
      },
      authStrategy: new LocalAuth({
        dataPath: process.env.NODE_ENV === "production" ? "BTA" : "DEV",
      }),
    });
    
    // Ensure public directory exists
    const publicDir = path.join(process.cwd(), "public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    this.qrCodePath = path.join(publicDir, "qr-code.png");
    
    // Initialize socket handler
    this.socketHandler = new SocketHandler(this);
  }


  setSocketIO(io: any) {
    this.socketHandler.initialize(io);
  }

  async initialize() {
    await this.client.initialize(); 
    
    this.setupWhatsAppEventHandlers();
  }
  

  private setupWhatsAppEventHandlers() {
    // Handle authentication events
    this.client.on("authenticated", () => {
      console.log("Client is authenticated!");
      this.isAuthenticated = true;
      this.socketHandler.emitAuthStatus();
    });
    
    this.client.on("auth_failure", () => {
      console.log("Authentication failed!");
      this.isAuthenticated = false;
      this.socketHandler.emitAuthStatus();
    });
    
    this.client.on("disconnected", (reason) => {
      console.log("Client was disconnected", reason);
      this.isAuthenticated = false;
      this.socketHandler.emitAuthStatus();
    });
    
    this.client.once("ready", () => {
      console.log("Client is ready!");
      this.isAuthenticated = true;
      this.socketHandler.emitAuthStatus();
      this.GetQRCode();
      
      // Set up message event handler
      this.setupMessageHandler();
    });
  }
  
 
  private setupMessageHandler() {
    // Listen for new messages
    this.client.on('message', async (message) => {
      // Check if message is from a chat with unread messages
      const chat = await message.getChat();
      if (chat.unreadCount > 0) {
        this.unreadChats = chat.unreadCount;
        this.socketHandler.emitUnreadCount();
      }
    });
    
    // Periodically check for unread messages
    setInterval(async () => {
      if (this.isAuthenticated) {
        try {
          // Get all chats
          const chats = await this.client.getChats();
          
      
          let count = 0;
          for (const chat of chats) {
            if (chat.unreadCount > 0) {
              count += chat.unreadCount;
            }
          }
          
          // Update unread count if changed
          if (count !== this.unreadChats) {
            this.unreadChats = count;
            this.socketHandler.emitUnreadCount();
          }
        } catch (error) {
          console.error('Error checking unread messages:', error);
        }
      }
    }, 5000); // Check every 10 seconds
  }
  
  /**
   * Generate and save QR code
   */
  GetQRCode() {
    this.client.on("qr", (qr) => {
      const QR = QRCode.imageSync(qr, { type: "png" });
      // Save QR code to file
      fs.writeFileSync(this.qrCodePath, QR);
      console.log("QR Code saved to:", this.qrCodePath);
      
      // Emit event to all connected clients
      this.socketHandler.emitQRUpdate();
    });
  }
  

  getClientStats() {
    return {
      isAuthenticated: this.isAuthenticated,
      unreadChats: this.unreadChats
    };
  }
  
  
  clearQRCodes() {
    try {
      // Check if QR code file exists
      if (fs.existsSync(this.qrCodePath)) {
        // Delete the QR code file
        fs.unlinkSync(this.qrCodePath);
        console.log('QR code file deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting QR code file:', error);
    }
  }
}

export default WhatsApp;
