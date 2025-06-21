import express from "express";
import QueueService from "../services/Queue";
import WhatsApp from "../services/WhatsApp";

const router = express.Router();

router.get("/", async (req, res) => {
    const whatsapp = req.app.get("whatsapp") as WhatsApp;
    const queueService = QueueService.getInstance();
    
    const whatsappStats = whatsapp ? whatsapp.getClientStats() : { isAuthenticated: false, unreadChats: 0 };
    
    const downloaderQueueCount =  await queueService.getDownloaderQueueCount() ;
    const lastDownload =await queueService.getLastSuccessfulDownload() ;
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        whatsapp: {
            isAuthenticated: whatsappStats.isAuthenticated,
            unreadChats: whatsappStats.unreadChats
        },
        queues: {
            size: downloaderQueueCount,
            lastDownload
        }
    });
});

export default router; 