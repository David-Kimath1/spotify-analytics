const mongoose = require('mongoose');

const wrappedRecapSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  period: {
    type: String,
    enum: ['weekly', 'monthly', 'yearly'],
    required: true
  },
  startDate: Date,
  endDate: Date,
  data: {
    topArtists: [{
      name: String,
      id: String,
      minutesListened: Number,
      imageUrl: String
    }],
    topTracks: [{
      name: String,
      id: String,
      playCount: Number,
      imageUrl: String
    }],
    totalMinutesListened: Number,
    totalTracksPlayed: Number,
    topGenre: String,
    listeningStreak: Number,
    mostActiveHour: Number,
    uniqueArtists: Number,
    uniqueTracks: Number
  },
  shareableUrl: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

wrappedRecapSchema.index({ userId: 1, period: 1, endDate: -1 });

module.exports = mongoose.model('WrappedRecap', wrappedRecapSchema);