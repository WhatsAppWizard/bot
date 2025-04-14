class TikTokError extends Error {
    constructor(message: string = "Unknown error") {
        super(message);
        this.name = "TikTokError";
        this.message =  message;
    }
}

export default TikTokError;