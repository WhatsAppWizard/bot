import QueueService from "../services/Queue";
import WhatsApp from "../services/WhatsApp";
import express from "express";

const router = express.Router();

router.get("/", async (req, res) => {
    const whatsapp = req.app.get("whatsapp") as WhatsApp;
    const queueService = QueueService.getInstance();
    
    const whatsappStats = whatsapp ? whatsapp.getClientStats() : { isAuthenticated: false, unreadChats: 0 };
    
    const downloaderQueueCount = queueService ? await queueService.getDownloaderQueueCount() : 0;
    
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        whatsapp: {
            isAuthenticated: whatsappStats.isAuthenticated,
            unreadChats: whatsappStats.unreadChats
        },
        queues: {
            downloader: downloaderQueueCount
        }
    });
});

export default router; 