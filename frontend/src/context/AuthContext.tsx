import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

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
  isAdmin: () => boolean;
  isDoctor: () => boolean;
  isTokenValid: () => Promise<boolean>;
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
  const apiRoot = '/api';

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

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        // Validate token with backend before setting user
        const isValid = await isTokenValid();
        if (isValid) {
          setUser(JSON.parse(storedUser));
        } else {
          // Token is invalid, clear everything
          logout();
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const isTokenValid = async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return false;

      const response = await axios.get(`${apiRoot}/auth/validate-token`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.status === 200;
    } catch (error) {
      // If validation fails, token is invalid
      return false;
    }
  };

  const register = async (userData: { email: string; password: string; full_name: string }) => {
    try {
      setLoading(true);
      const response = await axios.post(`${apiRoot}/auth/register`, userData);

      const { access_token, user } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      setUser(user);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const apiError = error.response.data?.error || error.response.data?.message;

        // If user already exists, treat registration as idempotent and try login with provided credentials.
        if (status === 409) {
          try {
            const loginResponse = await axios.post(`${apiRoot}/auth/login`, {
              email: userData.email,
              password: userData.password
            });

            const { access_token, user } = loginResponse.data;
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);
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

      const { access_token, user } = response.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      setUser(user);
      
      // Return redirect information
      return { redirectTo: '/' };
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.error || 'Invalid credentials');
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
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isSuperAdmin = (): boolean => {
    return user?.role === 'super_admin';
  };

  const isAdmin = (): boolean => {
    return user?.role === 'admin' || user?.role === 'super_admin';
  };

  const isDoctor = (): boolean => {
    return user?.role === 'doctor' || user?.role === 'admin' || user?.role === 'super_admin';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      register, 
      isSuperAdmin, 
      isAdmin, 
      isDoctor,
      isTokenValid
    }}>
      {children}
    </AuthContext.Provider>
  );
};