import ConfigService from "./Config";
import LRedis from "./Redis";

class RateLimiterService {
  private redisClient = new LRedis();
  constructor() {}

  public async isRatedLimited(chatId: string) {
    const key = `rate_limit:${chatId}`;
    const value = await this.redisClient.get(key);
    if (value) {
      // possibly rate limited
      const rateLimit = parseInt(value, 10);
      if (rateLimit >= ConfigService.getHardcodedRatelimit()) {
        return true; // Rate limited
      } else {
        await this.redisClient.setWithExpireIn(key, `${rateLimit + 1}`); // Increment rate limit with expiration
        return false; // Not rate limited
      }
    } else {
      await this.redisClient.setWithExpireIn(key, "1"); // Set rate limit with expiration
      return false; // Not rate limited
    }
  }
}

export default RateLimiterService;
