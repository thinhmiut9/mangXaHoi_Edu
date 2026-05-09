import axios, { AxiosError } from 'axios'

const runtimeApiUrl = `${window.location.protocol}//${window.location.hostname}:5001`
const envApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_URL = (envApiUrl ? envApiUrl : runtimeApiUrl).replace(/\/+$/, '')

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
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
    const requestUrl = err.config?.url ?? ''
    const isPublicAuthRequest = [
      '/auth/login',
      '/auth/register',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].some(path => requestUrl.includes(path))

    if (!isPublicAuthRequest && (status === 401 || (status === 403 && code === 'ACCOUNT_BLOCKED')) && !isRedirectingToLogin) {
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
    const data = err.response?.data as { message?: string; code?: string } | undefined
    const message = data?.message ?? err.message
    const normalizedMessage = message.toLowerCase()
    if (
      data?.code === 'SERVICE_UNAVAILABLE' ||
      data?.code === 'DATABASE_UNAVAILABLE' ||
      data?.code === 'NEO4J_UNAVAILABLE' ||
      normalizedMessage.includes('could not perform discovery') ||
      normalizedMessage.includes('no routing servers available') ||
      normalizedMessage.includes('routingtable') ||
      normalizedMessage.includes('serviceunavailable') ||
      normalizedMessage.includes('sessionexpired') ||
      normalizedMessage.includes('getaddrinfo enotfound')
    ) {
      return 'He thong dang tam thoi khong ket noi duoc co so du lieu. Neu dung Neo4j Aura, hay mo lai database roi thu lai.'
    }
    if (data?.code === 'INVALID_CREDENTIALS') {
      return 'Email hoặc mật khẩu không đúng.'
    }
    if (data?.code === 'ACCOUNT_BLOCKED') {
      return data.message ?? 'Tài khoản của bạn đang bị khóa.'
    }
    if (err.code === 'ECONNABORTED') {
      return 'Server phản hồi chậm. Vui lòng thử lại sau ít giây.'
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Không kết nối được tới máy chủ API. Hãy kiểm tra URL backend/CORS.'
    }
    if (err.response?.status === 429) {
      return 'Bạn đang thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại.'
    }
    return message
  }
  if (err instanceof Error) return err.message
  return 'Có lỗi xảy ra.'
}
