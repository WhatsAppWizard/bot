import { PostHog } from "posthog-node";
import ConfigService from "./Config";

class AnalyticsService {
  private client: PostHog;

  constructor() {
    const apiKey = ConfigService.getPostHogApiKey();

    const host = ConfigService.getPostHogHost();

    if (!apiKey) {
      throw new Error("PostHog API key is not set in the environment variables.");
    }

    this.client = new PostHog(apiKey, {
      host,
      flushInterval: 10000, // Flush events every 10 seconds
      flushAt: 5, // Flush when 20 events are queued
    });
  }

  trackEvent(
    eventName: string,
    userId: string,
    properties: Record<string, any> = {},
    groups?: Record<string, string>
  ) {
    this.client.capture({
      distinctId: userId,
      event: eventName,
      properties,
      groups,
      timestamp: new Date(),
    });
  }

 
  identifyUser(userId: string, userProperties: Record<string, any> = {}) {
    this.client.identify({
      distinctId: userId,
      properties: userProperties,
    });
  }


  updateUserProperties(userId: string, userProperties: Record<string, any>) {
    this.client.identify({
      distinctId: userId,
      properties: userProperties,
    });
  }

  flush() {
    this.client.flush();
  }

  /**
   * Shutdown the client properly
   */
  shutdown() {
    this.client.shutdown();
  }
}

export default new AnalyticsService();
