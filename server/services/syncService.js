const ListeningActivity = require('../models/ListeningActivity');
const User = require('../models/User');
const spotifyService = require('./spotifyService');

class SyncService {
  async syncUserRecentlyPlayed(userId) {
    const user = await User.findById(userId);
    if (!user) return;

    // Get the most recent played track from database
    const lastActivity = await ListeningActivity.findOne({ userId })
      .sort({ playedAt: -1 });

    let before = null;
    let syncedCount = 0;

    while (true) {
      const recentlyPlayed = await spotifyService.getRecentlyPlayed(
        userId, 
        50, 
        before
      );

      if (!recentlyPlayed || recentlyPlayed.length === 0) break;

      for (const item of recentlyPlayed) {
        const playedAt = new Date(item.played_at);
        
        // Skip if we already have this track
        const exists = await ListeningActivity.findOne({ 
          userId, 
          playedAt 
        });

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
            duration: item.track.duration_ms,
            context: this.getContextType(item.context)
          });
          syncedCount++;
        } else if (lastActivity && playedAt.getTime() === lastActivity.playedAt.getTime()) {
          // We've reached already synced tracks
          break;
        }
      }

      // Check if we need to continue pagination
      if (recentlyPlayed.length < 50) break;
      
      // Set before to the oldest track's timestamp + 1ms to avoid duplicates
      before = new Date(recentlyPlayed[recentlyPlayed.length - 1].played_at).getTime() + 1;
      
      // Avoid infinite loop
      if (syncedCount > 1000) break;
    }

    user.lastSyncAt = new Date();
    await user.save();

    return syncedCount;
  }

  getContextType(context) {
    if (!context) return 'unknown';
    if (context.type === 'playlist') return 'playlist';
    if (context.type === 'album') return 'album';
    if (context.type === 'artist') return 'artist';
    return 'unknown';
  }

  async syncAllUsers() {
    const users = await User.find();
    const results = [];
    
    for (const user of users) {
      try {
        const count = await this.syncUserRecentlyPlayed(user._id);
        results.push({ userId: user._id, synced: count });
      } catch (error) {
        console.error(`Failed to sync user ${user._id}:`, error);
        results.push({ userId: user._id, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = new SyncService();