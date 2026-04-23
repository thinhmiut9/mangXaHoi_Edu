import { apiClient, ApiResponse } from './client'
import { normalizeUser, FrontendUser } from './normalize'

export interface LoginDto { email: string; password: string }
export interface RegisterDto { email: string; username?: string; displayName: string; password: string }
export interface ChangePasswordDto { currentPassword: string; newPassword: string }
export interface AuthResult { user: User; token: string }
export type User = FrontendUser

export const authApi = {
  login: (dto: LoginDto) =>
    apiClient.post<ApiResponse<{ user: any; token: string }>>('/auth/login', dto).then(r => ({
      user: normalizeUser(r.data.data.user),
      token: r.data.data.token,
    })),

  register: (dto: RegisterDto) =>
    apiClient.post<ApiResponse<{ user: any; token: string }>>('/auth/register', dto).then(r => ({
      user: normalizeUser(r.data.data.user),
      token: r.data.data.token,
    })),

  me: () =>
    apiClient.get<ApiResponse<any>>('/auth/me').then(r => normalizeUser(r.data.data)),

  logout: () =>
    apiClient.post('/auth/logout'),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }),

  changePassword: (dto: ChangePasswordDto) =>
    apiClient.post('/auth/change-password', dto),
}
