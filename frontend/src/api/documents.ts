import { apiClient, ApiResponse } from './client'
import { toIsoString, toNumber } from './normalize'

export type DocumentFileType = 'PDF' | 'DOC' | 'PPT'

export interface LearningDocument {
  id: string
  title: string
  fileName: string
  fileUrl: string
  previewUrl?: string
  type: DocumentFileType
  subject?: string
  school?: string
  major?: string
  cohort?: string
  description?: string
  tags: string[]
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
  status: 'ACTIVE' | 'PENDING' | 'REJECTED'
  views: number
  downloads: number
  isSaved?: boolean
  uploaderId: string
  uploaderName?: string
  uploaderAvatar?: string
  createdAt: string
  updatedAt: string
}

export interface ListDocumentsQuery {
  q?: string
  school?: string
  major?: string
  fileType?: DocumentFileType | ''
  timeRange?: 'ALL' | '7D' | '30D' | '90D'
  sortBy?: 'NEWEST' | 'POPULAR' | 'RATING'
  page?: number
  limit?: number
}

export interface CreateDocumentPayload {
  file: File
  title?: string
  subject?: string
  school?: string
  major?: string
  cohort?: string
  description?: string
  tags?: string
  visibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
}

function normalizeDocument(raw: any): LearningDocument {
  return {
    id: raw.documentId ?? raw.id ?? '',
    title: raw.title ?? '',
    fileName: raw.fileName ?? '',
    fileUrl: raw.fileUrl ?? '',
    previewUrl: raw.previewUrl ?? undefined,
    type: (raw.fileType ?? 'PDF') as DocumentFileType,
    subject: raw.subject ?? '',
    school: raw.school ?? '',
    major: raw.major ?? '',
    cohort: raw.cohort ?? '',
    description: raw.description ?? '',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((item: unknown): item is string => typeof item === 'string') : [],
    visibility: (raw.visibility ?? 'PUBLIC') as 'PUBLIC' | 'FRIENDS' | 'PRIVATE',
    status: (raw.status ?? 'ACTIVE') as 'ACTIVE' | 'PENDING' | 'REJECTED',
    views: toNumber(raw.viewsCount),
    downloads: toNumber(raw.downloadsCount),
    isSaved: !!raw.isSaved,
    uploaderId: raw.uploaderId ?? '',
    uploaderName: raw.uploaderName ?? '',
    uploaderAvatar: raw.uploaderAvatar ?? '',
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  }
}

export const documentsApi = {
  getInlineUrl: (documentId: string) => `${apiClient.defaults.baseURL}/documents/${documentId}/file`,
  getDownloadUrl: (documentId: string) => `${apiClient.defaults.baseURL}/documents/${documentId}/download`,

  fetchInlineBlob: async (documentId: string) => {
    const response = await apiClient.get(`/documents/${documentId}/file`, { responseType: 'blob' })
    return response.data as Blob
  },

  fetchDownloadBlob: async (documentId: string) => {
    const response = await apiClient.get(`/documents/${documentId}/download`, { responseType: 'blob' })
    return response.data as Blob
  },

  getAccessUrl: async (documentId: string, download = false) => {
    const response = await apiClient.get<ApiResponse<{ url: string }>>(`/documents/${documentId}/access-url`, {
      params: download ? { download: '1' } : undefined,
    })
    return response.data.data.url
  },

  recordView: async (documentId: string) => {
    const response = await apiClient.post<ApiResponse<any>>(`/documents/${documentId}/view`)
    return normalizeDocument(response.data.data)
  },

  recordDownload: async (documentId: string) => {
    const response = await apiClient.post<ApiResponse<any>>(`/documents/${documentId}/download-track`)
    return normalizeDocument(response.data.data)
  },

  toggleSave: async (documentId: string) => {
    const response = await apiClient.post<ApiResponse<{ saved: boolean }>>(`/documents/${documentId}/save`)
    return { saved: !!response.data.data?.saved }
  },

  list: async (query: ListDocumentsQuery = {}) => {
    const params: Record<string, unknown> = {
      q: query.q ?? '',
      school: query.school ?? '',
      major: query.major ?? '',
      timeRange: query.timeRange ?? 'ALL',
      sortBy: query.sortBy ?? 'NEWEST',
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    }
    if (query.fileType) params.fileType = query.fileType

    const response = await apiClient.get<ApiResponse<any[]>>('/documents', { params })
    return {
      ...response.data,
      data: (response.data.data ?? []).map(normalizeDocument),
    }
  },

  listSaved: async (page = 1, limit = 20) => {
    const response = await apiClient.get<ApiResponse<any[]>>('/documents/saved', { params: { page, limit } })
    return {
      ...response.data,
      data: (response.data.data ?? []).map(normalizeDocument),
    }
  },

  listMine: async (page = 1, limit = 20) => {
    const response = await apiClient.get<ApiResponse<any[]>>('/documents/mine', { params: { page, limit } })
    return {
      ...response.data,
      data: (response.data.data ?? []).map(normalizeDocument),
    }
  },

  create: async (payload: CreateDocumentPayload) => {
    const form = new FormData()
    form.append('document', payload.file)
    if (payload.title) form.append('title', payload.title)
    if (payload.subject) form.append('subject', payload.subject)
    if (payload.school) form.append('school', payload.school)
    if (payload.major) form.append('major', payload.major)
    if (payload.cohort) form.append('cohort', payload.cohort)
    if (payload.description) form.append('description', payload.description)
    if (payload.tags) form.append('tags', payload.tags)
    if (payload.visibility) form.append('visibility', payload.visibility)

    const response = await apiClient.post<ApiResponse<any>>('/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return normalizeDocument(response.data.data)
  },
}
