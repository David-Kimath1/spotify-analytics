const ListeningActivity = require('../models/ListeningActivity');
const User = require('../models/User');
const spotifyService = require('./spotifyService');
const crypto = require('crypto');

class SyncService {
  eventKey(trackId, name, artistName, playedAt) {
    return crypto.createHash('sha256')
      .update(`${trackId || `${name || ''}|${artistName || ''}`}|${new Date(playedAt).toISOString()}`)
      .digest('hex');
  }

  async syncUserRecentlyPlayed(userId) {
    const user = await User.findById(userId);
    if (!user) return 0;

    try {
      const recentlyPlayed = await spotifyService.getRecentlyPlayed(userId, 50);
      if (!recentlyPlayed || recentlyPlayed.length === 0) return 0;

      let synced = 0;
      for (const item of recentlyPlayed) {
        const playedAt = new Date(item.played_at);
        const track = item.track;
        if (!track || Number.isNaN(playedAt.getTime())) continue;
        const trackId = track.id || undefined;
        const artistName = (track.artists || []).map(a => a.name).filter(Boolean).join(', ');
        const dedupeKey = this.eventKey(trackId, track.name, artistName, playedAt);
        const exists = await ListeningActivity.findOne({ userId, dedupeKey }).select('_id');

        if (!exists) {
          await ListeningActivity.create({
            userId,
            trackId,
            trackName: track.name,
            artistName,
            artistIds: (track.artists || []).map(a => a.id).filter(Boolean),
            artists: (track.artists || []).map(a => ({ id: a.id, name: a.name })),
            albumId: track.album?.id,
            albumName: track.album?.name,
            albumImage: track.album?.images?.[0]?.url,
            playedAt,
            playedDurationMs: track.duration_ms || 0,
            trackDurationMs: track.duration_ms || 0,
            durationAccuracy: 'estimated',
            duration: track.duration_ms || 0,
            source: 'spotify-api',
            sources: ['spotify-api'],
            dedupeKey
          });
          synced++;
        }
      }
      
      user.lastSyncAt = new Date();
      await user.save();
      return synced;
    } catch (error) {
      console.error('Spotify listening history sync failed:', error.response?.status || error.message);
      throw error;
    }
  }

  async syncAllUsers() {
    const users = await User.find({ spotifyRefreshToken: { $exists: true, $ne: '' } }).select('_id');
    const results = [];
    for (const user of users) {
      try {
        results.push({ userId: user._id, synced: await this.syncUserRecentlyPlayed(user._id) });
      } catch (error) {
        results.push({ userId: user._id, error: error.message });
      }
    }
    return results;
  }
}

module.exports = new SyncService();
