const mongoose = require('mongoose');

const listeningActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trackId: String,
  trackName: String,
  artistName: String,
  artistIds: [String],
  albumName: String,
  albumImage: String,
  playedAt: {
    type: Date,
    required: true
  },
  duration: Number,
  context: {
    type: String,
    enum: ['playlist', 'album', 'artist', 'search', 'unknown'],
    default: 'unknown'
  },
  playCount: {
    type: Number,
    default: 1
  },
  lastPlayedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
listeningActivitySchema.index({ userId: 1, playedAt: -1 });
listeningActivitySchema.index({ userId: 1, trackId: 1 });
listeningActivitySchema.index({ userId: 1, trackId: 1, playedAt: -1 });

module.exports = mongoose.model('ListeningActivity', listeningActivitySchema);
