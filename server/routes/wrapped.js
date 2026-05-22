const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const WrappedRecap = require('../models/WrappedRecap');
const statsService = require('../services/statsService');

router.get('/recap/:period', authenticateToken, async (req, res) => {
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
    
    // Check if we have a cached recap
    let recap = await WrappedRecap.findOne({
      userId: req.userId,
      period,
      endDate: { $gte: endDate }
    });
    
    if (!recap) {
      const stats = await statsService.getUserStats(req.userId, period);
      
      recap = new WrappedRecap({
        userId: req.userId,
        period,
        startDate,
        endDate,
        data: stats
      });
      
      await recap.save();
    }
    
    res.json(recap);
  } catch (error) {
    console.error('Wrapped error:', error);
    res.status(500).json({ error: 'Failed to generate wrapped recap' });
  }
});

router.get('/share/:recapId', authenticateToken, async (req, res) => {
  try {
    const recap = await WrappedRecap.findById(req.params.recapId);
    if (!recap || recap.userId.toString() !== req.userId.toString()) {
      return res.status(404).json({ error: 'Recap not found' });
    }
    
    // Generate shareable URL
    const shareableUrl = `${process.env.CLIENT_URL}/share/${recap._id}`;
    recap.shareableUrl = shareableUrl;
    await recap.save();
    
    res.json({ shareableUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate shareable link' });
  }
});

module.exports = router;