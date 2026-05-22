const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const spotifyService = require('../services/spotifyService');
const syncService = require('../services/syncService');

router.get('/currently-playing', authenticateToken, async (req, res) => {
  try {
    const current = await spotifyService.getCurrentPlaying(req.userId);
    res.json(current);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const profile = await spotifyService.getUserProfile(req.userId);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const result = await syncService.syncUserRecentlyPlayed(req.userId);
    res.json({ message: `Synced ${result.synced || result} tracks` });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

module.exports = router;
