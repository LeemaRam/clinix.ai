import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { API_ROOT } from '../services/apiFetch';

const normalizeUserRole = (role: string | undefined): string => {
  const rawRole = String(role || '').toLowerCase().trim();
  if (['superadmin', 'super_admin', 'admin'].includes(rawRole)) return 'super_admin';
  return 'doctor';
};

interface User {
  _id: string;
  full_name: string;
  email: string;
  role: string;
  subscription_plan_id?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ redirectTo: string }>;
  logout: () => void;
  register: (userData: { email: string; password: string; full_name: string }) => Promise<void>;
  isSuperAdmin: () => boolean;
  isDoctor: () => boolean;
  isTokenValid: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const apiRoot = API_ROOT;

  // Setup axios interceptor for token validation
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, logout user
          logout();
        }
        return Promise.reject(error);
      }
    );

    // Cleanup function to remove interceptors
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []); // Empty dependency array since logout is stable

  const persistUser = (user: User, token: string) => {
    const normalizedUser = { ...user, role: normalizeUserRole(user.role) };
    localStorage.setItem('access_token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    localStorage.setItem('user_name', normalizedUser.full_name || (normalizedUser as any).fullName || normalizedUser.email || '');
    setUser(normalizedUser);
    return normalizedUser;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');

      if (token) {
        try {
          const currentUser = await isTokenValid();
          if (currentUser) {
            const normalizedUser = { ...currentUser, role: normalizeUserRole(currentUser.role) };
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            localStorage.setItem('user_name', normalizedUser.full_name || (normalizedUser as any).fullName || normalizedUser.email || '');
            setUser(normalizedUser);
          } else {
            // Token invalid, clean up
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            localStorage.removeItem('user_name');
          }
        } catch (error) {
          // Network error or server down, keep user logged in locally
          // but mark as potentially stale
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUser(parsedUser);
            } catch {
              // Invalid stored user data, clean up
              localStorage.removeItem('access_token');
              localStorage.removeItem('user');
              localStorage.removeItem('user_name');
            }
          }
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const isTokenValid = async (): Promise<User | null> => {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    try {
      const response = await axios.get(`${apiRoot}/auth/validate-token`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const user = response.data?.data?.user || response.data?.user;
      return response.status === 200 ? user || null : null;
    } catch (error) {
      // Only treat 401/403 as a real "invalid token" signal that should
      // sign the user out. Rate limiting (429), network failures, and
      // server errors (5xx) are transient and must not wipe the session.
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 401 || status === 403) {
          return null;
        }
      }
      // Re-throw so the caller (checkAuth) can keep the existing session
      // based on the locally stored user.
      throw error;
    }
  };

  const register = async (userData: { email: string; password: string; full_name: string }) => {
    try {
      setLoading(true);
      const response = await axios.post(`${apiRoot}/auth/register`, userData);
      const payload = response.data || {};
      const access_token = payload.access_token || payload.token || payload.data?.access_token || payload.data?.token;
      const user = payload.user || payload.data?.user || payload.data;

      if (!access_token || !user) {
        throw new Error('Registration response was malformed');
      }

      persistUser(user, access_token);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const apiError = error.response.data?.error || error.response.data?.message;

        if (status === 409 || (status === 400 && String(apiError).toLowerCase().includes('already exists'))) {
          try {
            const loginResponse = await axios.post(`${apiRoot}/auth/login`, {
              email: userData.email,
              password: userData.password
            });

            const loginPayload = loginResponse.data || {};
            const access_token = loginPayload.access_token || loginPayload.token || loginPayload.data?.access_token || loginPayload.data?.token;
            const user = loginPayload.user || loginPayload.data?.user || loginPayload.data;

            if (!access_token || !user) {
              throw new Error('Email already registered. Please log in.');
            }

            persistUser(user, access_token);
            return;
          } catch {
            throw new Error('Email already registered. Please log in.');
          }
        }

        throw new Error(apiError || 'Registration failed');
      }
      if (axios.isAxiosError(error) && !error.response) {
        throw new Error('Unable to reach server. Please ensure backend is running on port 5000.');
      }
      throw new Error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await axios.post(`${apiRoot}/auth/login`, { email, password });
      const payload = response.data || {};
      const access_token = payload.access_token || payload.token || payload.data?.access_token || payload.data?.token;
      const user = payload.user || payload.data?.user || payload.data;

      if (!access_token || !user) {
        throw new Error('Login response was malformed');
      }

      const normalizedUser = persistUser(user, access_token);
      const redirectTo = normalizedUser.role === 'super_admin' ? '/super-admin' : '/';
      return { redirectTo };
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || error.response.data?.message || 'Invalid credentials');
      }
      if (axios.isAxiosError(error) && !error.response) {
        throw new Error('Unable to reach server. Please ensure backend is running on port 5000.');
      }
      throw new Error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    const token = localStorage.getItem('access_token');
    
    // Call backend logout endpoint for server-side cleanup
    if (token) {
      axios.post(`${apiRoot}/auth/logout`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }).catch(() => {
        // Ignore logout endpoint errors - client-side cleanup will still work
      });
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_name');
    setUser(null);
  };

  const isSuperAdmin = (): boolean => {
    return user?.role === 'super_admin';
  };

  const isDoctor = (): boolean => {
    return user?.role === 'doctor' || user?.role === 'super_admin';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      register, 
      isSuperAdmin, 
      isDoctor,
      isTokenValid
    }}>
      {children}
    </AuthContext.Provider>
  );
};