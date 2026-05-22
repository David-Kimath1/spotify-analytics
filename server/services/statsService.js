const ListeningActivity = require('../models/ListeningActivity');

class StatsService {
  async getUserStats(userId) {
    const activities = await ListeningActivity.find({ userId }).sort({ playedAt: -1 }).limit(100);
    const totalMinutes = Math.floor(activities.reduce((sum, a) => sum + (a.duration || 0), 0) / 60000);
    
    const artistCount = {};
    activities.forEach(a => { artistCount[a.artistName] = (artistCount[a.artistName] || 0) + 1; });
    const topArtists = Object.entries(artistCount).slice(0, 5).map(([name]) => ({ id: name, name }));
    
    const uniqueDays = new Set(activities.map(a => a.playedAt.toISOString().split('T')[0]));
    
    return {
      totalMinutes,
      totalTracks: activities.length,
      uniqueArtists: Object.keys(artistCount).length,
      topArtists,
      listeningStreak: uniqueDays.size
    };
  }
}

module.exports = new StatsService();
