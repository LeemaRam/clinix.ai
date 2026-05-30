import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

const API_URL = String(import.meta.env.VITE_API_URL || '').trim();

const shouldUseProxy = (() => {
  if (!API_URL) return true;
  try {
    const { hostname } = new URL(API_URL);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return true;
  }
})();

export const API_ROOT = shouldUseProxy ? '/api' : `${API_URL}/api`;

const withApiRoot = (path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_ROOT}${normalized}`;
};

type ApiFetchConfig = Omit<AxiosRequestConfig, 'url'> & {
  path: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error: AxiosError, attempt: number, maxRetries: number): boolean => {
  if (attempt >= maxRetries) return false;

  // Retry on network errors or 5xx server errors
  if (!error.response) return true; // Network error
  if (error.response.status >= 500) return true; // Server error

  // Don't retry on client errors (4xx) except 429 (rate limit)
  if (error.response.status === 429) return true;

  return false;
};

export const apiFetch = async <T = any>({
  path,
  retryOnFailure = true,
  maxRetries = 3,
  ...config
}: ApiFetchConfig): Promise<AxiosResponse<T>> => {
  let lastError: AxiosError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios({
        url: withApiRoot(path),
        timeout: 600000, // 10 minute default timeout for long-running requests
        ...config,
      });
      return response;
    } catch (error) {
      lastError = error as AxiosError;

      if (!retryOnFailure || !shouldRetry(lastError, attempt, maxRetries)) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await sleep(delay);
    }
  }

  throw lastError!;
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const unwrapApiData = <T>(payload: any): T => {
  if (!payload) return payload as T;

  const responseData = payload.data ?? payload;

  if (
    responseData &&
    typeof responseData === 'object' &&
    'success' in responseData &&
    'data' in responseData
  ) {
    return responseData.data as T;
  }

  return responseData as T;
};
