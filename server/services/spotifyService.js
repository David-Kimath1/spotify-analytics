const axios = require('axios');
const User = require('../models/User');

const metadataCache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function cacheSet(key, value, ttl = CACHE_TTL_MS) {
  if (metadataCache.size > 5000) {
    const now = Date.now();
    for (const [cacheKey, item] of metadataCache) if (item.expiresAt <= now) metadataCache.delete(cacheKey);
    while (metadataCache.size > 4500) metadataCache.delete(metadataCache.keys().next().value);
  }
  metadataCache.set(key, { value, expiresAt: Date.now() + ttl });
}

class SpotifyService {
  async refreshAccessToken(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const response = await axios.post('https://accounts.spotify.com/api/token', 
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.spotifyRefreshToken
      }),
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    user.spotifyAccessToken = response.data.access_token;
    user.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);
    await user.save();
    return response.data.access_token;
  }

  async makeSpotifyRequest(userId, endpoint, params = {}) {
    let user = await User.findById(userId);
    if (!user) throw new Error('Spotify account is disconnected');
    if (!user.spotifyAccessToken || (user.tokenExpiresAt && user.tokenExpiresAt.getTime() <= Date.now() + 30000)) {
      await this.refreshAccessToken(userId);
      user = await User.findById(userId);
    }
    let token = user.spotifyAccessToken;

    try {
      const response = await axios.get(`https://api.spotify.com/v1${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        params
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        const newToken = await this.refreshAccessToken(userId);
        const retryResponse = await axios.get(`https://api.spotify.com/v1${endpoint}`, {
          headers: { 'Authorization': `Bearer ${newToken}` },
          params
        });
        return retryResponse.data;
      }
      if (error.response?.status === 429) {
        const retryAfter = Number(error.response.headers?.['retry-after'] || 1);
        const rateError = new Error(`Spotify rate limit reached. Retry in ${retryAfter} seconds.`);
        rateError.status = 429;
        rateError.retryAfter = retryAfter;
        throw rateError;
      }
      throw error;
    }
  }

  async getRecentlyPlayed(userId, limit = 50) {
    const data = await this.makeSpotifyRequest(userId, '/me/player/recently-played', { limit });
    return data.items || [];
  }

  async getCurrentPlaying(userId) {
    try {
      const data = await this.makeSpotifyRequest(userId, '/me/player/currently-playing');
      return data;
    } catch {
      return null;
    }
  }

  async getTopItems(userId, type = 'tracks', limit = 20, timeRange = 'medium_term') {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const normalizedRange = ['short_term', 'medium_term', 'long_term'].includes(timeRange) ? timeRange : 'medium_term';
    const cacheKey = `top:${userId}:${type}:${normalizedLimit}:${normalizedRange}`;
    const cached = metadataCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const data = await this.makeSpotifyRequest(userId, `/me/top/${type}`, { limit: normalizedLimit, time_range: normalizedRange });
    const value = data.items || [];
    cacheSet(cacheKey, value);
    return value;
  }

  async getArtistsByIds(userId, ids = []) {
    const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
    const uncached = unique.filter(id => {
      const cached = metadataCache.get(`artist:${id}`);
      return !cached || cached.expiresAt <= Date.now();
    });
    for (let i = 0; i < uncached.length; i += 50) {
      const batch = uncached.slice(i, i + 50);
      if (!batch.length) continue;
      const data = await this.makeSpotifyRequest(userId, '/artists', { ids: batch.join(',') });
      for (const artist of data.artists || []) {
        cacheSet(`artist:${artist.id}`, artist);
      }
    }
    return unique.map(id => metadataCache.get(`artist:${id}`)?.value).filter(Boolean);
  }

  async getTrackById(userId, id) {
    if (!id) return null;
    const cacheKey = `track:${id}`;
    const cached = metadataCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.makeSpotifyRequest(userId, `/tracks/${encodeURIComponent(id)}`);
    cacheSet(cacheKey, value);
    return value;
  }

  async getTracksByIds(userId, ids = []) {
    const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
    const uncached = unique.filter(id => {
      const cached = metadataCache.get(`track:${id}`);
      return !cached || cached.expiresAt <= Date.now();
    });
    for (let i = 0; i < uncached.length; i += 50) {
      const batch = uncached.slice(i, i + 50);
      if (!batch.length) continue;
      const data = await this.makeSpotifyRequest(userId, '/tracks', { ids: batch.join(',') });
      for (const track of data.tracks || []) {
        if (track) cacheSet(`track:${track.id}`, track);
      }
    }
    return unique.map(id => metadataCache.get(`track:${id}`)?.value).filter(Boolean);
  }

  async getUserProfile(userId) {
    const cacheKey = `profile:${userId}`;
    const cached = metadataCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const value = await this.makeSpotifyRequest(userId, '/me');
    cacheSet(cacheKey, value, 10 * 60 * 1000);
    return value;
  }

  async getSavedTracks(userId, limit = 30, offset = 0) {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);
    const normalizedOffset = Math.max(Number(offset) || 0, 0);
    const cacheKey = `library:${userId}:${normalizedLimit}:${normalizedOffset}`;
    const cached = metadataCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const data = await this.makeSpotifyRequest(userId, '/me/tracks', { limit: normalizedLimit, offset: normalizedOffset });
    const value = { items: data.items || [], total: data.total || 0, next: data.next || null, offset: normalizedOffset };
    cacheSet(cacheKey, value, 10 * 60 * 1000);
    return value;
  }
}

module.exports = new SpotifyService();
