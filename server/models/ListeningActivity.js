const mongoose = require('mongoose');
const listeningActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Type.ObjectId,
        ref: 'User',
        required: true
    },
    trackId: String,
    trackName: String,
    artistName: String,
    artistIds: [String],
    playedAt: {
        type: Date,
        required: true,
        unique: true
    },
    duration: Number,
    context: {
        type: String,
        enum: ['playlist', 'album', 'artist', 'search' , 'uknown'],
        default: 'unknown'
    },
});

listeningActivitySchema.index ({ userId: 1, playedAt: -1});
listeningActivitySchema.index({ userId: 1, trackId: 1});

module.exports = mongoose.model('listeningActivity', listeningActivitySchema);
