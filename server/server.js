require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIO = require('socket.io');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const spotifyRoutes = require('./routes/spotify');
const analyticsRoutes = require('./routes/analytics');
const socialRoutes = require('./routes/social');
const wrappedRoutes = require('./routes/wrapped');

const { setupSocketHandlers } = require('./sockets/socketHandlers');
const { startSyncJobs } = require('./jobs/syncJobs');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://127.0.0.1:3000',
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://127.0.0.1:3000',
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/wrapped', wrappedRoutes);
app.use('/api/badges', require('./routes/badges'));
app.use('/api/playlist', require('./routes/playlist'));
app.use('/api/badges', require('./routes/badges'));
app.use('/api/playlist', require('./routes/playlist'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Socket.IO
setupSocketHandlers(io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => {
    console.log('✅ Connected to MongoDB');
    startSyncJobs();
    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });
