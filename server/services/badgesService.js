const ListeningActivity = require('../models/ListeningActivity');

class BadgesService {
  async getUserBadges(userId) {
    const activities = await ListeningActivity.find({ userId });
    
    if (activities.length === 0) return [];
    
    const badges = [];
    const uniqueDays = new Set(activities.map(a => a.playedAt.toISOString().split('T')[0]));
    const artistCount = {};
    let totalMinutes = 0;
    let nightPlays = 0;
    let earlyPlays = 0;
    
    activities.forEach(a => {
      artistCount[a.artistName] = (artistCount[a.artistName] || 0) + 1;
      totalMinutes += (a.duration || 0);
      const hour = a.playedAt.getHours();
      if (hour >= 0 && hour < 5) nightPlays++;
      if (hour >= 5 && hour < 8) earlyPlays++;
    });
    
    totalMinutes = Math.floor(totalMinutes / 60000);
    const topArtist = Object.entries(artistCount).sort((a,b) => b[1] - a[1])[0];
    const uniqueArtists = Object.keys(artistCount).length;
    
    if (nightPlays > 10) {
      badges.push({ name: '🌙 Night Owl', description: 'Listened after midnight 10+ times', icon: '🌙' });
    }
    if (earlyPlays > 10) {
      badges.push({ name: '☀️ Early Bird', description: 'Early morning listener', icon: '☀️' });
    }
    if (uniqueDays.size >= 7) {
      badges.push({ name: '🔥 Hot Streak', description: `${uniqueDays.size} day streak`, icon: '🔥' });
    }
    if (topArtist && topArtist[1] >= 50) {
      badges.push({ name: '👑 Top Fan', description: `${topArtist[0]} - ${topArtist[1]} plays`, icon: '👑' });
    }
    if (uniqueArtists >= 20) {
      badges.push({ name: '🎨 Explorer', description: `${uniqueArtists} different artists`, icon: '🎨' });
    }
    if (totalMinutes >= 1000) {
      badges.push({ name: '🏃 Marathon', description: `${totalMinutes} minutes total`, icon: '🏃' });
    }
    
    return badges;
  }
}

module.exports = new BadgesService();
