import axios from 'axios';

class ShortenerService {
  private readonly API_URL = 'https://spoo.me/';

  /**
   * Shortens a URL using the spoo.me API
   * @param longUrl The URL to be shortened
   * @returns The shortened URL
   */
  public async shortenUrl(longUrl: string): Promise<string> {
    try {
      const data = {
        url: longUrl,
      };

      const response = await axios.post(this.API_URL, data, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });

      if (response.status === 200 && response.data.short_url) {
        return response.data.short_url;
      }

      throw new Error('Failed to shorten URL');
    } catch (error) {
      console.error('Error shortening URL:', error);
      throw error;
    }
  }
}

export const shortenerService = new ShortenerService(); 