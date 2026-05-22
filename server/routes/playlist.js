const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const playlistService = require('../services/playlistService');

// Smart playlist - with option to sync to Spotify
router.post('/smart', authenticateToken, async (req, res) => {
  try {
    const { limit = 30, syncToSpotify = false } = req.body;
    const playlist = await playlistService.generateSmartPlaylist(req.userId, limit, syncToSpotify);
    res.json({ success: true, playlist });
  } catch (error) {
    console.error('Smart playlist error:', error);
    res.status(500).json({ error: 'Failed to generate smart playlist' });
  }
});

// Mood-based playlist with Spotify sync
router.post('/mood/:mood', authenticateToken, async (req, res) => {
  try {
    const { mood } = req.params;
    const { syncToSpotify = false } = req.body;
    const playlist = await playlistService.generateMoodPlaylist(req.userId, mood, syncToSpotify);
    res.json({ success: true, playlist });
  } catch (error) {
    console.error('Mood playlist error:', error);
    res.status(500).json({ error: 'Failed to generate mood playlist' });
  }
});

module.exports = router;
