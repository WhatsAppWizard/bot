import { Server, Socket } from "socket.io";

import WhatsApp from "./WhatsApp";

class SocketService {
  private io: Server | null = null;
  private whatsappService: WhatsApp;

  constructor(whatsappService: WhatsApp) {
    this.whatsappService = whatsappService;
  }

  initialize(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on("connection", (socket: Socket) => {
      console.log("Client connected");
      
      // Handle authentication status check request
      socket.on("check-auth-status", () => {
        console.log("Auth status check requested");
        this.emitAuthStatus(socket);
      });
      
      // Handle unread chats count request
      socket.on("get-unread-count", () => {
        console.log("Unread count requested");
        this.emitUnreadCount(socket);
      });
    });
  }


  emitAuthStatus(socket?: Socket) {
    if (!this.io) return;

    const authData = { 
      isAuthenticated: this.whatsappService.isAuthenticated,
      timestamp: new Date().getTime()
    };
    
    if (socket) {
      // Send to specific socket
      socket.emit("auth-status", authData);
    } else {
      // Broadcast to all clients
      this.io.emit("auth-status", authData);
    }
  }
  

  emitUnreadCount(socket?: Socket) {
    if (!this.io) return;

    const unreadData = {
      count: this.whatsappService.unreadChats,
      timestamp: new Date().getTime()
    };
    
    if (socket) {
      // Send to specific socket
      socket.emit("unread-count", unreadData);
    } else {
      // Broadcast to all clients
      this.io.emit("unread-count", unreadData);
    }
  }


  emitQRUpdate() {
    if (!this.io) return;

    this.io.emit("qr-update", { 
      timestamp: new Date().getTime(),
      exists: true 
    });
  }
}

export default SocketService; 