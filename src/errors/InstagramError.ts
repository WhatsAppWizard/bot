class InstagramError extends Error {
  constructor(message: string = "Unknown error") {
    super(message);
    this.name = "InstagramDownloadError";
    this.message = message;
  }
}

export default InstagramError;