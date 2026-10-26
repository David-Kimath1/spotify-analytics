const analyticsService = require('./analyticsService');

class StatsService {
  async getUserStats(userId, period = '30d') {
    const range = analyticsService.getRange(period || '30d');
    const [result, records] = await Promise.all([
      analyticsService.overview(userId, range, period || '30d'),
      analyticsService.records(userId, range)
    ]);
    return {
      ...result.totals,
      totalTracks: result.totals.tracksPlayed,
      topArtists: result.topArtists,
      listeningStreak: records.longestStreak,
      coverage: result.coverage
    };
  }
}

module.exports = new StatsService();
