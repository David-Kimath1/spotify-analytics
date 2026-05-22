const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const ListeningActivity = require('../models/ListeningActivity');
const WrappedRecap = require('../models/WrappedRecap');

// Get wrapped recap (or preview if not enough data)
router.get('/recap/:period', authenticateToken, async (req, res) => {
  try {
    const { period } = req.params;
    const now = new Date();
    let startDate, endDate;
    const isPreview = req.query.preview === 'true';
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        endDate = new Date();
        break;
      case 'yearly':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        endDate = new Date();
        break;
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }
    
    // Get activities in date range
    const activities = await ListeningActivity.find({
      userId: req.userId,
      playedAt: { $gte: startDate, $lte: endDate }
    });
    
    // Calculate stats
    const totalMinutes = Math.floor(activities.reduce((sum, a) => sum + (a.duration || 0), 0) / 60000);
    const totalTracks = activities.length;
    const uniqueArtists = new Set(activities.map(a => a.artistName)).size;
    const uniqueTracks = new Set(activities.map(a => a.trackId)).size;
    
    // Top artists
    const artistCount = {};
    activities.forEach(a => {
      artistCount[a.artistName] = (artistCount[a.artistName] || 0) + 1;
    });
    const topArtists = Object.entries(artistCount)
      .map(([name, plays]) => ({ name, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);
    
    // Top tracks
    const trackCount = {};
    activities.forEach(a => {
      const key = `${a.trackName}|${a.artistName}`;
      trackCount[key] = {
        trackName: a.trackName,
        artistName: a.artistName,
        plays: (trackCount[key]?.plays || 0) + 1,
        albumImage: a.albumImage
      };
    });
    const topTracks = Object.values(trackCount)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5);
    
    // Calculate streak
    const uniqueDays = new Set(activities.map(a => a.playedAt.toISOString().split('T')[0]));
    const listeningStreak = uniqueDays.size;
    
    const recapData = {
      period,
      isPreview: activities.length < 10 || isPreview,
      startDate,
      endDate,
      data: {
        totalMinutes,
        totalTracks,
        uniqueArtists,
        uniqueTracks,
        topArtists,
        topTracks,
        listeningStreak,
        message: activities.length < 10 
          ? `Keep listening! ${10 - activities.length} more tracks needed for full Wrapped.` 
          : `Your ${period} wrapped is ready!`
      }
    };
    
    res.json(recapData);
  } catch (error) {
    console.error('Wrapped error:', error);
    res.status(500).json({ error: 'Failed to generate wrapped recap' });
  }
});

// Generate and save wrapped (only when enough data)
router.post('/generate/:period', authenticateToken, async (req, res) => {
  try {
    const { period } = req.params;
    const now = new Date();
    let startDate, endDate;
    
    switch (period) {
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'monthly':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        endDate = new Date();
        break;
      case 'yearly':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        endDate = new Date();
        break;
      default:
        return res.status(400).json({ error: 'Invalid period' });
    }
    
    const activities = await ListeningActivity.find({
      userId: req.userId,
      playedAt: { $gte: startDate, $lte: endDate }
    });
    
    if (activities.length < 10) {
      return res.status(400).json({ error: 'Not enough data for wrapped. Keep listening!' });
    }
    
    // Calculate and save wrapped...
    const totalMinutes = Math.floor(activities.reduce((sum, a) => sum + (a.duration || 0), 0) / 60000);
    // ... (rest of calculation)
    
    const recap = new WrappedRecap({
      userId: req.userId,
      period,
      startDate,
      endDate,
      data: { totalMinutes, totalTracks: activities.length }
    });
    
    await recap.save();
    res.json({ message: 'Wrapped generated!', recap });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate wrapped' });
  }
});

module.exports = router;
