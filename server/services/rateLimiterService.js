class RateLimiterService {
  constructor() {
    this.requestCount = 0;
    this.lastReset = Date.now();
    this.waitTime = 0;
    this.consecutiveErrors = 0;
  }

  canMakeRequest() {
    const now = Date.now();
    
    // Reset counter every minute
    if (now - this.lastReset > 60000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    
    // If we're in cooldown, return false
    if (this.waitTime > 0 && now < this.waitTime) {
      const waitSeconds = Math.ceil((this.waitTime - now) / 1000);
      console.log(`⏳ Rate limit active, waiting ${waitSeconds} seconds...`);
      return false;
    }
    
    // Spotify limit: ~180 requests per minute
    if (this.requestCount >= 150) {
      this.waitTime = now + 30000; // Wait 30 seconds
      console.log('⚠️ Approaching rate limit, cooling down for 30 seconds');
      return false;
    }
    
    this.requestCount++;
    return true;
  }

  recordSuccess() {
    this.consecutiveErrors = 0;
  }

  recordError(error) {
    this.consecutiveErrors++;
    
    if (error.response?.status === 429) { // Too Many Requests
      const retryAfter = error.response.headers['retry-after'] || 60;
      this.waitTime = Date.now() + (retryAfter * 1000);
      console.log(`🚫 Rate limited! Waiting ${retryAfter} seconds...`);
      return true;
    }
    return false;
  }

  getBackoffDelay() {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
    const delay = Math.min(1000 * Math.pow(2, this.consecutiveErrors), 32000);
    return delay;
  }
}

module.exports = new RateLimiterService();
