require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIO = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');

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
const clientOrigin = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const io = socketIO(server, {
  cors: {
    origin: clientOrigin,
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: clientOrigin,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: mongoose.connection.readyState === 1 ? 'OK' : 'DEGRADED', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', timestamp: new Date() });
});

if (process.env.NODE_ENV === 'production') {
  const clientBuild = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuild, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientBuild, 'index.html'), error => { if (error) next(error); });
  });
}

// Socket.IO
setupSocketHandlers(io);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {})
  .then(() => {
    console.log(`✅ Connected to MongoDB database: ${mongoose.connection.name}`);
    startSyncJobs();
    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err.message);
    process.exit(1);
  });
