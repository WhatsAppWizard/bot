import Redis from "ioredis";
import ConfigService from "./Config";

class LRedis {
  private static instance: LRedis;
    private redisClient: Redis;
   constructor() {
    // Initialize Redis connection here
    this.redisClient = new Redis(ConfigService.getRedis());

  }

  public static getInstance(): LRedis {
    if (!LRedis.instance) {
      LRedis.instance = new LRedis();
    }
    return LRedis.instance;
  }

  public async setWithExpireIn(key: string, value: string): Promise<void> {
    // Set key-value pair in Redis
    try {
      await this.redisClient.set(key, value, "EX", 60*5); // Set expiration to 5 minutes
    } catch (error) {
      console.error("Error setting value in Redis:", error);
    }
  }

  public async get(key: string): Promise<string | null> {
    // Get value by key from Redis
    try {
      const value = await this.redisClient.get(key);
      return value;
    } catch (error) {
      console.error("Error getting value from Redis:", error);
    }
    return null;
  }

  public async del(key: string): Promise<void> {
    // Delete key from Redis
    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error("Error deleting key from Redis:", error);
    }
  }
}


export default LRedis;