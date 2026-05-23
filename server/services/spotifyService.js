const axios = require('axios');
const User = require('../models/User');

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

  async getTopItems(userId, type = 'tracks', limit = 20) {
    const data = await this.makeSpotifyRequest(userId, `/me/top/${type}`, { limit });
    return data.items || [];
  }

  async getUserProfile(userId) {
    return this.makeSpotifyRequest(userId, '/me');
  }
}

module.exports = new SpotifyService();
