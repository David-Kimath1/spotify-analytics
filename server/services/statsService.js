const ListeningActivity = require('../models/ListeningActivity');
const User = require('../models/User');

class StatsService {
  async getUserStats(userId, timeRange = 'month') {
    const now = new Date();
    let startDate;

    switch (timeRange) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const activities = await ListeningActivity.find({
      userId,
      playedAt: { $gte: startDate }
    });

    // Calculate total minutes
    const totalMinutes = Math.floor(activities.reduce((sum, a) => sum + a.duration, 0) / 60000);

    // Calculate top artists
    const artistCount = new Map();
    activities.forEach(activity => {
      artistCount.set(activity.artistName, (artistCount.get(activity.artistName) || 0) + 1);
    });
    const topArtists = Array.from(artistCount.entries())
      .map(([name, count]) => ({ name, plays: count }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Calculate top tracks
    const trackCount = new Map();
    activities.forEach(activity => {
      const key = `${activity.trackName}|${activity.artistName}`;
      trackCount.set(key, (trackCount.get(key) || 0) + 1);
    });
    const topTracks = Array.from(trackCount.entries())
      .map(([key, plays]) => {
        const [trackName, artistName] = key.split('|');
        return { trackName, artistName, plays };
      })
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10);

    // Calculate daily listening streak
    const uniqueDays = new Set(activities.map(a => a.playedAt.toDateString()));
    const listeningStreak = this.calculateStreak(activities);

    return {
      totalMinutes,
      totalTracks: activities.length,
      uniqueArtists: artistCount.size,
      uniqueTracks: trackCount.size,
      topArtists,
      topTracks,
      listeningStreak,
      dailyActivity: this.getDailyActivity(activities)
    };
  }

  calculateStreak(activities) {
    if (activities.length === 0) return 0;
    
    const dates = [...new Set(activities.map(a => a.playedAt.toDateString()))].sort();
    let streak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
      
      if (diffDays === 1) {
        currentStreak++;
        streak = Math.max(streak, currentStreak);
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }
    
    return streak;
  }

  getDailyActivity(activities) {
    const dailyMap = new Map();
    activities.forEach(activity => {
      const date = activity.playedAt.toDateString();
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    });
    return Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));
  }

  async generateDailyStatsForAllUsers() {
    const users = await User.find();
    for (const user of users) {
      await this.getUserStats(user._id, 'week'); // Cache this somehow
    }
  }
}

module.exports = new StatsService();