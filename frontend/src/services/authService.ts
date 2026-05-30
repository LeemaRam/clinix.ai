import { apiFetch } from './apiFetch';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  role: 'doctor' | 'super_admin';
  isActive: boolean;
  language?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  full_name: string;
  email: string;
  password: string;
  role?: 'doctor' | 'super_admin';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  access_token: string;
  token: string;
  user: User;
  data: {
    access_token: string;
    token: string;
    user: User;
  };
}

// Register a new user
export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const res = await apiFetch({
    path: '/auth/register',
    method: 'POST',
    data
  });
  return res.data;
};

// Login user
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const res = await apiFetch({
    path: '/auth/login',
    method: 'POST',
    data
  });
  return res.data;
};

// Validate token
export const validateToken = async (): Promise<{ user: User }> => {
  const token = localStorage.getItem('access_token');
  if (!token) {
    throw new Error('No token found');
  }

  const res = await apiFetch({
    path: '/auth/validate-token',
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data.data;
};

// Get user profile
export const getProfile = async (): Promise<User> => {
  const res = await apiFetch({
    path: '/auth/profile',
    method: 'GET',
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
  });
  return res.data.data;
};

// Logout (client-side only - just remove token)
export const logout = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('access_token');
};

// Get current user from localStorage
export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};