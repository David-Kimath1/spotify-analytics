const cron = require('node-cron');
const syncService = require('../services/syncService');
const statsService = require('../services/statsService');

const startSyncJobs = () => {
  // Sync recently played every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running user sync job...');
    try {
      const results = await syncService.syncAllUsers();
      console.log(`Synced ${results.length} users`);
    } catch (error) {
      console.error('Sync job failed:', error);
    }
  });

  // Generate daily stats for all users at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Generating daily stats...');
    try {
      await statsService.generateDailyStatsForAllUsers();
    } catch (error) {
      console.error('Stats generation failed:', error);
    }
  });

  // Clean up old notifications (older than 30 days) every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('Cleaning up old notifications...');
    const Notification = require('../models/Notification');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Notification.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
    console.log('Old notifications cleaned up');
  });
};

module.exports = { startSyncJobs };