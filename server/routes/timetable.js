const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const ListeningActivity = require('../models/ListeningActivity');

router.get('/date/:date', authenticateToken, async (req, res) => {
  try {
    const targetDate = new Date(req.params.date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    const activities = await ListeningActivity.find({
      userId: req.userId,
      playedAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ playedAt: -1 });
    
    const totalMinutes = Math.floor(activities.reduce((sum, a) => sum + (a.duration || 0), 0) / 60000);
    
    res.json({
      date: req.params.date,
      tracks: activities.length,
      minutes: totalMinutes,
      activities: activities.slice(0, 20)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
