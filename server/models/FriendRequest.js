const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Type.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['friend_request', 'friend_accept', 'reaction', 'wrapped_ready'],
        required: true
    },
    
})