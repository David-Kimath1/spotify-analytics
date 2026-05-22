const ListeningActivity = require('../models/ListeningActivity');
const User = require('../models/User');
const spotifyService = require('./spotifyService');

class SyncService {
  async syncUserRecentlyPlayed(userId) {
    const user = await User.findById(userId);
    if (!user) return 0;

    try {
      const recentlyPlayed = await spotifyService.getRecentlyPlayed(userId, 50);
      if (!recentlyPlayed || recentlyPlayed.length === 0) return 0;

      let synced = 0;
      for (const item of recentlyPlayed) {
        const playedAt = new Date(item.played_at);
        const exists = await ListeningActivity.findOne({ userId, playedAt });
        
        if (!exists) {
          await ListeningActivity.create({
            userId,
            trackId: item.track.id,
            trackName: item.track.name,
            artistName: item.track.artists[0].name,
            artistIds: item.track.artists.map(a => a.id),
            albumName: item.track.album.name,
            albumImage: item.track.album.images[0]?.url,
            playedAt,
            duration: item.track.duration_ms
          });
          synced++;
        }
      }
      
      user.lastSyncAt = new Date();
      await user.save();
      return synced;
    } catch (error) {
      console.error('Sync error:', error);
      return 0;
    }
  }
}

module.exports = new SyncService();
