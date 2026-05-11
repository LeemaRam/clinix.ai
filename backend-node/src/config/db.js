import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './env.js';

export const connectToDatabase = async () => {
  try {
    // Ensure NODE_TLS_REJECT_UNAUTHORIZED is disabled before connecting
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    // Try to connect to real MongoDB first
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      // Disable SSL certificate verification for development
      // This prevents "tlsv1 alert internal error" when connecting to MongoDB Atlas
      tls: true,
      tlsAllowInvalidCertificates: true,
      authSource: 'admin',
      retryWrites: true,
      w: 'majority',
      family: 4,
      // Additional TLS settings
      tlsCAFile: undefined,
      tlsCertificateKeyFile: undefined
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return;
  } catch (realDbError) {
    console.warn(`⚠️ Could not connect to MongoDB at ${env.MONGODB_URI}: ${realDbError.message}`);

    // Fall back to a local disk-backed MongoDB so user accounts survive restarts.
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const dbPath = path.resolve(process.cwd(), '.mongo-data');
      fs.mkdirSync(dbPath, { recursive: true });

      console.log(`📦 Falling back to local MongoDB storage at ${dbPath}`);
      const mongod = await MongoMemoryServer.create({
        instance: {
          dbPath,
          storageEngine: 'wiredTiger'
        }
      });

      const uri = mongod.getUri();
      const conn = await mongoose.connect(uri);
      console.log(`✅ Local MongoDB started: ${conn.connection.host}`);
      return;
    } catch (memoryDbError) {
      console.error(`❌ Failed to start local MongoDB fallback: ${memoryDbError.message}`);
      process.exit(1);
    }
  }
};