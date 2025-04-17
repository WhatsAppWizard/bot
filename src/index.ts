import TelegramService from "./services/Telegram";
import WhatsApp from "./services/WhatsApp";
import app from "./services/Express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();


const telegramService = TelegramService.getInstance();

async function main() {
  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const whatsapp = new WhatsApp();

  // Set up exit handlers
  setupExitHandlers();

  // Make WhatsApp instance accessible to routes
  app.set("whatsapp", whatsapp);

  await whatsapp.initialize();
}

function setupExitHandlers() {
  // Handle graceful shutdown
  process.on("SIGINT", () => {
    telegramService.sendMessage("Server is shutting down gracefully...");
  });
  process.on("SIGTERM", () => {
    telegramService.sendMessage("MAYDAY: SERVER CRASHED...");
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);

  });
}


main();
