const cron = require('node-cron');
const syncService = require('../services/syncService');

const startSyncJobs = () => {
  // Sync every 2 minutes for better offline capture
  cron.schedule('*/2 * * * *', async () => {
    console.log('🔄 Running user sync job...');
    try {
      const results = await syncService.syncAllUsers();
      console.log(`✅ Synced ${results.length} users`);
    } catch (error) {
      console.error('❌ Sync job failed:', error);
    }
  });
};

module.exports = { startSyncJobs };
