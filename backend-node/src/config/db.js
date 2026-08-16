import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';

export const normalizeMongoUri = (uri) => {
  let value = String(uri || '').trim();
  const srvPrefix = 'mongodb+srv:';
  if (value.toLowerCase().startsWith(srvPrefix)) {
    let slashIndex = srvPrefix.length;
    while (value[slashIndex] === '/') slashIndex += 1;
    value = `${srvPrefix}//${value.slice(slashIndex)}`;
  }
  const standardSrvPrefix = 'mongodb+srv://';
  if (value.toLowerCase().startsWith(standardSrvPrefix)) {
    value = `${standardSrvPrefix}${value.slice(standardSrvPrefix.length).replace(/^\/+/, '')}`;
  }
  value = value.replace(/@([^/?#]+):\d+/, '@$1');
  if (!value.startsWith('mongodb+srv://')) return value;

  const authorityStart = 'mongodb+srv://'.length;
  const authorityEnd = value.search(/[/?#]/, authorityStart);
  const end = authorityEnd === -1 ? value.length : authorityEnd;
  const authority = value.slice(authorityStart, end);
  const atIndex = authority.lastIndexOf('@');
  const credentials = atIndex >= 0 ? authority.slice(0, atIndex + 1) : '';
  const host = atIndex >= 0 ? authority.slice(atIndex + 1) : authority;
  const normalizedHost = host.replace(/:\d+$/, '');

  let normalized = `${value.slice(0, authorityStart)}${credentials}${normalizedHost}${value.slice(end)}`;
  while (normalized.startsWith('mongodb+srv:////')) {
    normalized = `mongodb+srv://${normalized.slice('mongodb+srv:////'.length)}`;
  }
  return normalized;
};

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

    const conn = await mongoose.connect(normalizeMongoUri(env.MONGODB_URI));
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
};