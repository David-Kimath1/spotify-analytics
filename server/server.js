require('dotenv').config();
const http = require('http');
const socketIO = require('socket.io');
const app = require('./app');
const mongoose = require('mongoose');
const { connectDatabase } = require('./database');
const { setupSocketHandlers } = require('./sockets/socketHandlers');
const { startSyncJobs } = require('./jobs/syncJobs');

const server = http.createServer(app);
const clientOrigin = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const io = socketIO(server, { cors: { origin: clientOrigin, credentials: true } });

setupSocketHandlers(io);

connectDatabase()
  .then(() => {
    console.log(`✅ Connected to MongoDB database: ${mongoose.connection.name}`);
    startSyncJobs();
    const port = process.env.PORT || 5000;
    server.listen(port, () => console.log(`🚀 Server running on port ${port}`));
  })
  .catch(error => {
    console.error('❌ MongoDB error:', error.message);
    process.exit(1);
  });
