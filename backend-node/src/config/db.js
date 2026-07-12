import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env.js';

let memoryServer;

export const connectToDatabase = async () => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);

    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }

    console.warn('Falling back to an in-memory MongoDB instance for local development.');

    try {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'clinix_ai'
        }
      });

      const memoryUri = memoryServer.getUri();
      const conn = await mongoose.connect(memoryUri);
      console.log(`MongoDB Connected (memory): ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error(`Fallback MongoDB error: ${fallbackError.message}`);
      process.exit(1);
    }
  }
};