const ListeningActivity = require('../models/ListeningActivity');

class PlayCountService {
  async incrementPlayCount(userId, trackId, trackName, artistName, albumImage) {
    try {
      // Check if this track was played in the last 30 seconds (avoid duplicate counting)
      const recentPlay = await ListeningActivity.findOne({
        userId,
        trackId,
        playedAt: { $gte: new Date(Date.now() - 30000) }
      }).sort({ playedAt: -1 });

      if (recentPlay) {
        // Update existing record's play count
        recentPlay.playCount = (recentPlay.playCount || 1) + 1;
        recentPlay.lastPlayedAt = new Date();
        await recentPlay.save();
        return recentPlay;
      } else {
        // Create new listening record
        const newActivity = new ListeningActivity({
          userId,
          trackId,
          trackName,
          artistName,
          albumImage,
          playedAt: new Date(),
          playCount: 1,
          lastPlayedAt: new Date()
        });
        await newActivity.save();
        return newActivity;
      }
    } catch (error) {
      console.error('Error incrementing play count:', error);
      return null;
    }
  }

  async getTrackPlayCount(userId, trackId) {
    const activities = await ListeningActivity.find({ userId, trackId });
    const totalPlays = activities.reduce((sum, activity) => sum + (activity.playCount || 1), 0);
    return totalPlays;
  }

  async getAllTrackPlayCounts(userId) {
    const activities = await ListeningActivity.aggregate([
      { $match: { userId: userId } },
      { $group: {
        _id: '$trackId',
        trackName: { $first: '$trackName' },
        artistName: { $first: '$artistName' },
        albumImage: { $first: '$albumImage' },
        totalPlays: { $sum: '$playCount' },
        lastPlayed: { $max: '$playedAt' }
      }},
      { $sort: { totalPlays: -1 } },
      { $limit: 50 }
    ]);
    return activities;
  }
}

module.exports = new PlayCountService();
