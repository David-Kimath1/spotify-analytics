const cron = require('node-cron');
const syncService = require('../services/syncService');

const startSyncJobs = () => {
  // Poll at a modest interval to reduce Spotify API requests.
  cron.schedule('*/10 * * * *', async () => {
    console.log('Running scheduled Spotify sync...');
    try {
      const results = await syncService.syncAllUsers();
      console.log(`Synced ${results.length} Spotify accounts`);
    } catch (error) {
      console.error('Sync job failed:', error.message);
    }
  });
};

module.exports = { startSyncJobs };
