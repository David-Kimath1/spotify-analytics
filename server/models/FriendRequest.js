const mongoose = require('mongoose');
const friendRequestSchema = new mongoose.Schema ({
    from: {
        type: mongoose.Schema.Type.ObjectId,
        ref: 'User',
        required: true
    },
});