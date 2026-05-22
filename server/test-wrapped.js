require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const ListeningActivity = require('./models/ListeningActivity');
const WrappedRecap = require('./models/WrappedRecap');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const user = await User.findOne();
  if (!user) {
    console.log('No user found. Login to Spotify first!');
    process.exit();
  }
  
  const activities = await ListeningActivity.find({ userId: user._id });
  const trackCount = activities.length;
  
  if (trackCount === 0) {
    console.log('📭 No listening data yet. Listen to some music on Spotify!');
    console.log('Then click "Sync Now" on your dashboard.');
  } else {
    console.log(`\n🎵 Your Wrapped Preview (${trackCount} tracks so far):\n`);
    
    // Calculate top artists
    const artistCount = {};
    activities.forEach(a => {
      artistCount[a.artistName] = (artistCount[a.artistName] || 0) + 1;
    });
    const topArtists = Object.entries(artistCount).sort((a,b) => b[1] - a[1]).slice(0, 3);
    
    console.log('🏆 Top Artists:');
    topArtists.forEach(([name, count], i) => {
      console.log(`   ${i+1}. ${name} (${count} plays)`);
    });
    
    // Calculate total minutes
    const totalMs = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
    const totalMinutes = Math.floor(totalMs / 60000);
    console.log(`\n⏱️  Total Minutes: ${totalMinutes}`);
    
    // Calculate days with activity
    const uniqueDays = new Set(activities.map(a => a.playedAt.toISOString().split('T')[0]));
    console.log(`📅 Active Days: ${uniqueDays.size}`);
    
    if (uniqueDays.size >= 7) {
      console.log('\n✅ You have enough data for Weekly Wrapped!');
      console.log('   Check the Wrapped page in your app.');
    } else {
      console.log(`\n⏳ Need ${7 - uniqueDays.size} more days of listening for Weekly Wrapped`);
    }
  }
  
  process.exit();
});
