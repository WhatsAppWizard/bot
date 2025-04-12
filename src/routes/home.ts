// app/routes/userRoutes.js

import WhatsApp from "../services/WhatsApp";
import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

router.get("/", (req, res) => {
    const qrCodePath = path.join(process.cwd(), "public", "qr-code.png");
    const qrCodeExists = fs.existsSync(qrCodePath);
    
    // Get WhatsApp instance from app
    const whatsapp = req.app.get("whatsapp") as WhatsApp;
    const isAuthenticated = whatsapp ? whatsapp.getClientStats().isAuthenticated : false;
    
    res.render("home", {
        qrCodeExists,
        isAuthenticated,
        status: isAuthenticated ? "Authenticated" : (qrCodeExists ? "QR Code Available" : "Waiting for QR Code...")
    });
});

export default router;
