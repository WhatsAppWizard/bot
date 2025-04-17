import WhatsApp from "./services/WhatsApp";
import app from "./services/Express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

async function main() {
  dotenv.config();
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
  process.on("SIGINT", () => console.log("CRASHED!"));
  process.on("SIGTERM", () => console.log("CRASHED!"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  });
}

function cleanup(whatsappService: WhatsApp) {
  console.log("Cleaning up...");
  process.exit(0);
}

main();
