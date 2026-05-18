const mongoose = require('mongoose');
const userSchema = new.mongoose.Schema ({
    spotifyId: {
        type: String,
        required: true,
        unique: true
    },
    email: String,
    displayName: String,
    profileImage: String,
    spotifyAccessToken: {
        type: String,
        required: true
    },
    spotifyRefreshToken: {
        type: String,
        required: true
    },
    tokenExpiresAt: Date,
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    privacySetting: {
        shareActivity: { type: Boolean, default: true },
        shareTopArtists: { type: Boolean, default: true },
        shareListeningStats: { type: Boolean,default: true }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastSyncAt: Date
});

module.exports = mongoose.model('User', userSchema);