import { useState, useCallback, useRef } from 'react';
import { apiFetch, ApiFetchConfig } from '../services/apiFetch';
import { AxiosResponse } from 'axios';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<T | null>;
}

export function useApi<T = any>(
  apiCall: (...args: any[]) => Promise<AxiosResponse<T>>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    preventDuplicate?: boolean;
  } = {}
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeCallRef = useRef<Promise<any> | null>(null);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    // Prevent duplicate calls if requested
    if (options.preventDuplicate && activeCallRef.current) {
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const callPromise = apiCall(...args);
      activeCallRef.current = callPromise;

      const response = await callPromise;

      // Check if this is still the active call
      if (activeCallRef.current === callPromise) {
        const responseData = response.data?.data || response.data;
        setData(responseData);
        setError(null);
        options.onSuccess?.(responseData);
        return responseData;
      }
      return null;
    } catch (err: any) {
      // Check if this is still the active call
      if (activeCallRef.current) {
        const errorMessage = err.response?.data?.error ||
                           err.response?.data?.message ||
                           err.message ||
                           'An error occurred';
        setError(errorMessage);
        setData(null);
        options.onError?.(errorMessage);
      }
      return null;
    } finally {
      if (activeCallRef.current) {
        setLoading(false);
        activeCallRef.current = null;
      }
    }
  }, [apiCall, options]);

  return { data, loading, error, execute };
}

// Hook for managing multiple concurrent API calls
export function useApiManager() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  }, []);

  const setError = useCallback((key: string, error: string | null) => {
    setErrors(prev => ({ ...prev, [key]: error || undefined }));
  }, []);

  const executeApiCall = useCallback(async <T>(
    key: string,
    apiCall: () => Promise<AxiosResponse<T>>
  ): Promise<T | null> => {
    setLoading(key, true);
    setError(key, null);

    try {
      const response = await apiCall();
      const data = response.data?.data || response.data;
      return data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error ||
                         err.response?.data?.message ||
                         err.message ||
                         'An error occurred';
      setError(key, errorMessage);
      return null;
    } finally {
      setLoading(key, false);
    }
  }, [setLoading, setError]);

  const isLoading = useCallback((key: string) => loadingStates[key] || false, [loadingStates]);
  const getError = useCallback((key: string) => errors[key] || null, [errors]);

  const reset = useCallback((key?: string) => {
    if (key) {
      setLoadingStates(prev => ({ ...prev, [key]: false }));
      setErrors(prev => ({ ...prev, [key]: undefined }));
    } else {
      setLoadingStates({});
      setErrors({});
    }
  }, [setLoadingStates, setErrors]);

  return {
    executeApiCall,
    isLoading,
    getError,
    reset,
    loadingStates,
    errors
  };
}