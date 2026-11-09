const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let memoryServer = null;

// Search common Windows MongoDB binary paths to empower seamless embedded launch
const findLocalMongodBinary = () => {
  const candidates = [
    'C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\7.0\\bin\\mongod.exe',
    'C:\\Program Files\\MongoDB\\Server\\6.0\\bin\\mongod.exe'
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

/**
 * Connect to MongoDB with automated fallback to in-memory/embedded instance
 * to guarantee seamless execution across any environment.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bandwidth_monitor';

  try {
    // Attempt standard connection to specified URI (timeout 2000ms)
    console.log(`[DB] Attempting connection to MongoDB at: ${uri}`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`[DB] Successfully connected to MongoDB instance: ${mongoose.connection.host}:${mongoose.connection.port}`);
  } catch (err) {
    console.warn(`[DB] Direct MongoDB connection to ${uri} was unavailable (${err.message}).`);
    console.log('[DB] Activating automated local MongoDB instance...');

    const systemBinary = findLocalMongodBinary();
    if (systemBinary) {
      process.env.MONGOMS_SYSTEM_BINARY = systemBinary;
      console.log(`[DB] Using installed MongoDB binary: ${systemBinary}`);
    }

    // Set local cache directory inside the project to prevent sandbox EPERM errors
    const localCache = path.join(__dirname, '../../.cache');
    if (!fs.existsSync(localCache)) {
      fs.mkdirSync(localCache, { recursive: true });
    }
    process.env.MONGOMS_DOWNLOAD_DIR = localCache;

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'bandwidth_monitor'
        }
      });
      const memUri = memoryServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[DB] Successfully connected to Automated Local MongoDB: ${memUri}`);
    } catch (memErr) {
      console.error('[DB] Failed to initialize embedded MongoDB:', memErr.message);
      throw memErr;
    }
  }

  // Bind error listeners for unexpected disconnects
  mongoose.connection.on('error', (err) => {
    console.error(`[DB Error]: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB Disconnected] Lost connection to database.');
  });
};

/**
 * Disconnect database and cleanup resources
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }
    console.log('[DB] Database disconnected and resources released.');
  } catch (err) {
    console.error('[DB] Error during disconnect:', err.message);
  }
};

module.exports = {
  connectDB,
  disconnectDB
};
