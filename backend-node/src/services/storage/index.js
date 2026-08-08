import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { env } from '../../config/env.js';

const AZURE_PREFIX = 'azure://';
let blobServiceClient = null;

const normalizeProvider = () => String(env.STORAGE_PROVIDER || 'local').trim().toLowerCase();

export const isAzureStorageEnabled = () => normalizeProvider() === 'azure';

export const isAzureStorageRef = (value) =>
  typeof value === 'string' && value.trim().toLowerCase().startsWith(AZURE_PREFIX);

export const buildAzureStorageRef = ({ container, blobName }) => {
  if (!container || !blobName) {
    throw new Error('Azure storage reference requires container and blobName');
  }
  return `${AZURE_PREFIX}${container}/${blobName}`;
};

export const parseAzureStorageRef = (value) => {
  const raw = String(value || '').trim();
  if (!isAzureStorageRef(raw)) {
    throw new Error('Invalid Azure storage reference');
  }

  const withoutScheme = raw.slice(AZURE_PREFIX.length);
  const slashIndex = withoutScheme.indexOf('/');
  if (slashIndex <= 0 || slashIndex === withoutScheme.length - 1) {
    throw new Error('Invalid Azure storage reference format');
  }

  const container = withoutScheme.slice(0, slashIndex);
  const blobName = withoutScheme.slice(slashIndex + 1);
  return { container, blobName };
};

const ensureBlobServiceClient = () => {
  if (blobServiceClient) return blobServiceClient;

  if (env.AZURE_STORAGE_CONNECTION_STRING) {
    blobServiceClient = BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);
    return blobServiceClient;
  }

  const accountUrl = env.AZURE_STORAGE_ACCOUNT_URL
    || (env.AZURE_STORAGE_ACCOUNT_NAME
      ? `https://${env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`
      : '');

  if (!accountUrl) {
    throw new Error('Azure storage is enabled but account configuration is missing');
  }

  const credential = new DefaultAzureCredential();
  blobServiceClient = new BlobServiceClient(accountUrl, credential);
  return blobServiceClient;
};

const getBlockBlobClient = ({ container, blobName }) => {
  const client = ensureBlobServiceClient();
  return client.getContainerClient(container).getBlockBlobClient(blobName);
};

const streamToBuffer = async (readableStream) => {
  const chunks = [];
  for await (const chunk of readableStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const ensureTempDir = async () => {
  const tempDir = path.join(os.tmpdir(), 'clinix-storage-temp');
  await fsp.mkdir(tempDir, { recursive: true });
  return tempDir;
};

const randomSuffix = () => `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

const resolveLocalPath = ({ storagePath, localFallbackPath }) => {
  if (storagePath && fs.existsSync(storagePath)) {
    return storagePath;
  }

  if (localFallbackPath && fs.existsSync(localFallbackPath)) {
    return localFallbackPath;
  }

  return storagePath;
};

export const buildBlobName = ({ categoryPrefix, entityId, filename }) => {
  const safeEntity = String(entityId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = String(filename || randomSuffix()).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${categoryPrefix}/${safeEntity}/${safeName}`;
};

export const uploadPersistentFile = async ({
  localPath,
  container,
  blobName,
  contentType,
  localFallbackPath
}) => {
  if (!localPath) {
    throw new Error('uploadPersistentFile requires localPath');
  }

  if (!isAzureStorageEnabled()) {
    return localFallbackPath || localPath;
  }

  const blobClient = getBlockBlobClient({ container, blobName });
  await blobClient.uploadFile(localPath, {
    blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined
  });

  return buildAzureStorageRef({ container, blobName });
};

export const readStoredFileToBuffer = async ({ storagePath, localFallbackPath }) => {
  if (!storagePath) {
    throw new Error('readStoredFileToBuffer requires storagePath');
  }

  if (isAzureStorageRef(storagePath)) {
    const { container, blobName } = parseAzureStorageRef(storagePath);
    const blobClient = getBlockBlobClient({ container, blobName });
    const response = await blobClient.download();
    if (!response.readableStreamBody) {
      throw new Error('Blob download stream is empty');
    }
    return streamToBuffer(response.readableStreamBody);
  }

  const localPath = resolveLocalPath({ storagePath, localFallbackPath });
  return fsp.readFile(localPath);
};

export const createStoredFileReadStream = async ({ storagePath, localFallbackPath, buffer }) => {
  if (!storagePath) {
    throw new Error('createStoredFileReadStream requires storagePath');
  }

  if (buffer) {
    return {
      stream: Readable.from(buffer),
      contentType: undefined,
      contentLength: buffer.length
    };
  }

  if (isAzureStorageRef(storagePath)) {
    const { container, blobName } = parseAzureStorageRef(storagePath);
    const blobClient = getBlockBlobClient({ container, blobName });
    const response = await blobClient.download();
    if (!response.readableStreamBody) {
      throw new Error('Blob download stream is empty');
    }
    return {
      stream: response.readableStreamBody,
      contentType: response.contentType || 'application/octet-stream',
      contentLength: response.contentLength || undefined
    };
  }

  const localPath = resolveLocalPath({ storagePath, localFallbackPath });
  const stats = await fsp.stat(localPath);
  return {
    stream: fs.createReadStream(localPath),
    contentType: undefined,
    contentLength: stats.size
  };
};

export const deleteStoredFile = async ({ storagePath, localFallbackPath }) => {
  if (!storagePath) return;

  if (isAzureStorageRef(storagePath)) {
    const { container, blobName } = parseAzureStorageRef(storagePath);
    const blobClient = getBlockBlobClient({ container, blobName });
    await blobClient.deleteIfExists();
    return;
  }

  const localPath = resolveLocalPath({ storagePath, localFallbackPath });
  if (localPath && fs.existsSync(localPath)) {
    await fsp.unlink(localPath);
  }
};

export const materializeStoredFileToLocalTemp = async ({
  storagePath,
  preferredExtension = '.bin',
  prefix = 'blob-file'
}) => {
  if (!storagePath) {
    throw new Error('materializeStoredFileToLocalTemp requires storagePath');
  }

  if (!isAzureStorageRef(storagePath)) {
    return {
      localPath: storagePath,
      cleanup: async () => {}
    };
  }

  const tempDir = await ensureTempDir();
  const ext = preferredExtension.startsWith('.') ? preferredExtension : `.${preferredExtension}`;
  const tempFilePath = path.join(tempDir, `${prefix}-${randomSuffix()}${ext}`);
  const buffer = await readStoredFileToBuffer({ storagePath });
  await fsp.writeFile(tempFilePath, buffer);

  return {
    localPath: tempFilePath,
    cleanup: async () => {
      try {
        if (fs.existsSync(tempFilePath)) {
          await fsp.unlink(tempFilePath);
        }
      } catch (error) {
        console.warn('[storage] Failed to cleanup temp file:', tempFilePath, error?.message || error);
      }
    }
  };
};
