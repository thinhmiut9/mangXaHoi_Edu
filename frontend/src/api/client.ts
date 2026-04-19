import axios, { AxiosError } from 'axios'

const runtimeApiUrl = `${window.location.protocol}//${window.location.hostname}:5000`
const envApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_URL = (envApiUrl ? envApiUrl : runtimeApiUrl).replace(/\/+$/, '')

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Request interceptor — attach JWT token
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor — handle 401 globally
// Track if we're already redirecting to avoid multiple redirects
let isRedirectingToLogin = false

apiClient.interceptors.response.use(
  res => res,
  (err: AxiosError) => {
    const status = err.response?.status
    const code = (err.response?.data as { code?: string } | undefined)?.code
    if ((status === 401 || (status === 403 && code === 'ACCOUNT_BLOCKED')) && !isRedirectingToLogin) {
      isRedirectingToLogin = true
      // Xóa cả auth_token lẫn Zustand persisted store để tránh vòng lặp reload
      localStorage.removeItem('auth_token')
      localStorage.removeItem('edusocial-auth')
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message ?? err.message
  }
  if (err instanceof Error) return err.message
  return 'Có lỗi xảy ra'
}
