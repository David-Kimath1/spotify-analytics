const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const badgesService = require('../services/badgesService');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const badges = await badgesService.getUserBadges(req.userId);
    res.json({ badges });
  } catch (error) {
    console.error('Badges error:', error);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

module.exports = router;
