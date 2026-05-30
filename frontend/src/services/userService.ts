import { apiFetch, getAuthHeaders, unwrapApiData } from './apiFetch';

export interface UserProfile {
  _id: string;
  fullName: string;
  email: string;
  role: 'doctor' | 'super_admin';
  isActive: boolean;
  language?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  language?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Get user profile
export const getProfile = async (): Promise<UserProfile> => {
  const res = await apiFetch({
    path: '/user/profile',
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res);
};

// Update user profile
export const updateProfile = async (data: UpdateProfileRequest): Promise<UserProfile> => {
  const res = await apiFetch({
    path: '/user/profile',
    method: 'PUT',
    headers: getAuthHeaders(),
    data
  });
  return unwrapApiData(res);
};

// Change password
export const changePassword = async (data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> => {
  const res = await apiFetch({
    path: '/user/change-password',
    method: 'POST',
    headers: getAuthHeaders(),
    data
  });
  return { success: res.data.success, message: res.data.message }; // ApiResponse format
};

// Get user language preference
export const getLanguage = async (): Promise<{ language: string }> => {
  const res = await apiFetch({
    path: '/user/language',
    method: 'GET',
    headers: getAuthHeaders()
  });
  return unwrapApiData(res);
};

// Set user language preference
export const setLanguage = async (language: string): Promise<{ success: boolean; message: string }> => {
  const res = await apiFetch({
    path: '/user/language',
    method: 'PUT',
    headers: getAuthHeaders(),
    data: { language }
  });
  return { success: res.data.success, message: res.data.message }; // ApiResponse format
};