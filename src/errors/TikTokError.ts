class TikTokError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TikTokError";
        this.message = "Failed to download TikTok media: " + message;
    }
}

export default TikTokError;