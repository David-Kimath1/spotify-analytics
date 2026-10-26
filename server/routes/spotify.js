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

router.get('/library', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const result = await spotifyService.getSavedTracks(req.userId, limit, offset);
    res.json(result);
  } catch (error) {
    const status = error.response?.status === 403 ? 403 : (error.status || 500);
    res.status(status).json({ error: status === 403 ? 'Reconnect Spotify and approve saved library access to browse your library.' : error.message || 'Failed to fetch your Spotify library' });
  }
});

router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const synced = Number(await syncService.syncUserRecentlyPlayed(req.userId) || 0);
    res.json({ synced, message: `Synced ${synced} plays` });
  } catch (error) {
    const upstreamStatus = error.response?.status;
    const status = error.status === 429 || upstreamStatus === 429 ? 429
      : upstreamStatus === 401 || upstreamStatus === 403 ? upstreamStatus
        : 502;
    res.status(status).json({
      error: status === 429
        ? 'Spotify is rate limiting history sync. Wait briefly and try again.'
        : status === 401 || status === 403
          ? 'Spotify could not authorize history sync. Reconnect your Spotify account in Settings.'
          : 'Spotify history sync failed. Your stored analytics were not updated.'
    });
  }
});

module.exports = router;
