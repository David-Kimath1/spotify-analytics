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
  artists: [{ id: String, name: String }],
  albumId: String,
  albumName: String,
  albumImage: String,
  trackDurationMs: Number,
  genres: [String],
  playedAt: {
    type: Date,
    required: true
  },
  // Imported Extended History contains the actual streamed duration. Spotify's
  // recently-played endpoint has no duration, so those records are estimates.
  playedDurationMs: Number,
  durationAccuracy: { type: String, enum: ['exact', 'estimated'], default: 'estimated' },
  duration: Number,
  platform: String,
  skipped: Boolean,
  source: { type: String, enum: ['spotify-api', 'extended-history'], default: 'spotify-api' },
  sources: [String],
  dedupeKey: String,
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
listeningActivitySchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
listeningActivitySchema.index({ userId: 1, source: 1, playedAt: -1 });

module.exports = mongoose.model('ListeningActivity', listeningActivitySchema);
