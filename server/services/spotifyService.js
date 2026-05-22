const axios = require('axios');
const User = require('../models/User');

class SpotifyService {
  async refreshAccessToken(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    try {
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
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  async makeSpotifyRequest(userId, endpoint, params = {}, method = 'GET') {
    let user = await User.findById(userId);
    let token = user.spotifyAccessToken;

    const makeRequest = async (token) => {
      try {
        const config = {
          headers: { 'Authorization': `Bearer ${token}` }
        };
        
        let response;
        if (method === 'POST') {
          response = await axios.post(`https://api.spotify.com/v1${endpoint}`, params, config);
        } else {
          response = await axios.get(`https://api.spotify.com/v1${endpoint}`, { ...config, params });
        }
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          const newToken = await this.refreshAccessToken(userId);
          const config = { headers: { 'Authorization': `Bearer ${newToken}` } };
          
          let retryResponse;
          if (method === 'POST') {
            retryResponse = await axios.post(`https://api.spotify.com/v1${endpoint}`, params, config);
          } else {
            retryResponse = await axios.get(`https://api.spotify.com/v1${endpoint}`, { ...config, params });
          }
          return retryResponse.data;
        }
        throw error;
      }
    };

    return makeRequest(token);
  }

  async getRecentlyPlayed(userId, limit = 50, before = null) {
    const params = { limit };
    if (before) params.before = before;
    const data = await this.makeSpotifyRequest(userId, '/me/player/recently-played', params);
    return data.items || [];
  }

  async getCurrentPlaying(userId) {
    try {
      const data = await this.makeSpotifyRequest(userId, '/me/player/currently-playing');
      return data;
    } catch (error) {
      return null;
    }
  }

  async getTopItems(userId, type = 'tracks', limit = 20, timeRange = 'medium_term') {
    const data = await this.makeSpotifyRequest(userId, `/me/top/${type}`, {
      limit,
      time_range: timeRange
    });
    return data.items || [];
  }

  async getUserProfile(userId) {
    return this.makeSpotifyRequest(userId, '/me');
  }

  async getRecommendations(userId, params) {
    const data = await this.makeSpotifyRequest(userId, '/recommendations', params);
    return data;
  }

  async createPlaylist(userId, name, description, isPublic = false) {
    try {
      console.log('📝 Creating playlist for user:', userId);
      const profile = await this.getUserProfile(userId);
      console.log('👤 User profile ID:', profile.id);
      
      const data = await this.makeSpotifyRequest(userId, `/users/${profile.id}/playlists`, {
        name: name.substring(0, 100),
        description: description.substring(0, 300),
        public: isPublic
      }, 'POST');
      
      console.log('✅ Playlist created:', data.id);
      return data;
    } catch (error) {
      console.error('❌ Create playlist error:', error.response?.data || error.message);
      throw error;
    }
  }

  async addTracksToPlaylist(userId, playlistId, trackUris) {
    try {
      console.log(`📝 Adding ${trackUris.length} tracks to playlist ${playlistId}`);
      
      // Spotify accepts max 100 tracks per request
      for (let i = 0; i < trackUris.length; i += 100) {
        const chunk = trackUris.slice(i, i + 100);
        await this.makeSpotifyRequest(userId, `/playlists/${playlistId}/tracks`, {
          uris: chunk,
          position: 0
        }, 'POST');
      }
      
      console.log('✅ Tracks added successfully');
      return true;
    } catch (error) {
      console.error('❌ Add tracks error:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new SpotifyService();
