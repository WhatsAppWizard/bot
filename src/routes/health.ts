import express from "express";
import QueueService from "../services/Queue";
import WhatsApp from "../services/WhatsApp";

const router = express.Router();

router.get("/", async (req, res) => {
    const whatsapp = req.app.get("whatsapp") as WhatsApp;
    
    const whatsappStats = whatsapp ? whatsapp.getClientStats() : { isAuthenticated: false, unreadChats: 0 };
    
    const queue =  await QueueService.getInstance().getDownloaderQueueCount() ;
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        whatsapp: whatsappStats,
        queues: queue
    });
});

export default router; 