export class FacebookError extends Error {
  constructor(message: string = "Unknown error") {
    super(message);
    this.name = "FacebookDownloadError";
    this.message = message;
  }
}