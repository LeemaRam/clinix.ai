import mongoose from 'mongoose';
import { env } from './env.js';

export const connectToDatabase = async () => {
  try {
    // Try to connect to real MongoDB first
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return;
  } catch (realDbError) {
    console.warn(`⚠️ Could not connect to MongoDB at ${env.MONGODB_URI}: ${realDbError.message}`);

    // Fall back to in-memory MongoDB only if DEMO_MODE is explicitly true
    if (String(process.env.DEMO_MODE).toLowerCase() === 'true') {
      try {
        console.log('📦 DEMO_MODE=true — falling back to in-memory MongoDB for local development');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        const conn = await mongoose.connect(uri);
        console.log(`✅ In-memory MongoDB started: ${conn.connection.host}`);
        return;
      } catch (memoryDbError) {
        console.error(`❌ Failed to start in-memory MongoDB: ${memoryDbError.message}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Error: Could not connect to MongoDB and DEMO_MODE is not enabled. Please start MongoDB or set DEMO_MODE=true`);
      process.exit(1);
    }
  }
};