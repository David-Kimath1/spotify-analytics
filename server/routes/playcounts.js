const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const playCountService = require('../services/playCountService');

// Get play counts for all tracks
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const playCounts = await playCountService.getAllTrackPlayCounts(req.userId);
    res.json(playCounts);
  } catch (error) {
    console.error('Error fetching play counts:', error);
    res.status(500).json({ error: 'Failed to fetch play counts' });
  }
});

// Get play count for a specific track
router.get('/track/:trackId', authenticateToken, async (req, res) => {
  try {
    const playCount = await playCountService.getTrackPlayCount(req.userId, req.params.trackId);
    res.json({ trackId: req.params.trackId, playCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch track play count' });
  }
});

module.exports = router;
