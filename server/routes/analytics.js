const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const statsService = require('../services/statsService');
const spotifyService = require('../services/spotifyService');
const ListeningActivity = require('../models/ListeningActivity');

router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;
    const stats = await statsService.getUserStats(req.userId, timeRange);
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/top-artists', authenticateToken, async (req, res) => {
  try {
    const { timeRange = 'medium_term', limit = 20 } = req.query;
    const artists = await spotifyService.getTopItems(req.userId, 'artists', parseInt(limit), timeRange);
    res.json(artists);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top artists' });
  }
});

router.get('/top-tracks', authenticateToken, async (req, res) => {
  try {
    const { timeRange = 'medium_term', limit = 20 } = req.query;
    const tracks = await spotifyService.getTopItems(req.userId, 'tracks', parseInt(limit), timeRange);
    res.json(tracks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
});

router.get('/recently-played', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const activities = await ListeningActivity.find({ userId: req.userId })
      .sort({ playedAt: -1 })
      .limit(parseInt(limit));
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

router.get('/currently-playing', authenticateToken, async (req, res) => {
  try {
    const currentTrack = await spotifyService.getCurrentPlaying(req.userId);
    res.json(currentTrack);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current playing' });
  }
});

router.get('/listening-history', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { userId: req.userId };
    
    if (startDate) query.playedAt = { $gte: new Date(startDate) };
    if (endDate) query.playedAt = { ...query.playedAt, $lte: new Date(endDate) };
    
    const history = await ListeningActivity.find(query)
      .sort({ playedAt: -1 })
      .limit(1000);
    
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listening history' });
  }
});

module.exports = router;