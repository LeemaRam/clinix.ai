import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

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
};

export const apiFetch = <T = any>({ path, ...config }: ApiFetchConfig): Promise<AxiosResponse<T>> => {
  return axios({
    url: withApiRoot(path),
    ...config,
  });
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const unwrapApiData = <T>(payload: { data?: T } & T): T => {
  return (payload?.data || payload) as T;
};
