class InstagramDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstagramDownloadError";
    this.message = "Failed to download Instagram media: " + message;
  }
}

export default InstagramDownloadError;