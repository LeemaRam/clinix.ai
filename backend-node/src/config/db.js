import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';

export const connectToDatabase = async () => {
  try {
    const isSrvUri = typeof env.MONGODB_URI === 'string' && env.MONGODB_URI.startsWith('mongodb+srv://');
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || '')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);

    // Atlas SRV lookups can fail on some local DNS resolvers; allow explicit DNS overrides.
    if (isSrvUri && dnsServers.length) {
      dns.setServers(dnsServers);
      console.log(`MongoDB DNS servers override applied: ${dnsServers.join(', ')}`);
    }

    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};