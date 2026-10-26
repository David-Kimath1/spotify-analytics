const mongoose = require('mongoose');

let connectionPromise;

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10
    }).catch(error => {
      connectionPromise = null;
      throw error;
    });
  }

  await connectionPromise;
  return mongoose.connection;
}

mongoose.connection.on('disconnected', () => {
  connectionPromise = null;
});

module.exports = { connectDatabase };
