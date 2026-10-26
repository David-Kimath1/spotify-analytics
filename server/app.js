require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { connectDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const spotifyRoutes = require('./routes/spotify');
const analyticsRoutes = require('./routes/analytics');
const socialRoutes = require('./routes/social');
const wrappedRoutes = require('./routes/wrapped');
const badgesRoutes = require('./routes/badges');

const app = express();
const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : null;
const clientOrigin = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || vercelProductionUrl || 'http://localhost:3000';

app.use(helmet());
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: mongoose.connection.readyState === 1 ? 'OK' : 'DEGRADED',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

app.use(async (req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    res.status(503).json({ error: 'The database is unavailable. Check the MongoDB connection and try again.' });
  }
});

app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use('/api/auth', authRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/wrapped', wrappedRoutes);
app.use('/api/badges', badgesRoutes);

if (process.env.NODE_ENV === 'production' && process.env.VERCEL !== '1') {
  const clientBuild = path.join(__dirname, '../client/build');
  app.use(express.static(clientBuild, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(clientBuild, 'index.html'), error => { if (error) next(error); });
  });
}

module.exports = app;
