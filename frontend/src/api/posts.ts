import { apiClient, ApiResponse } from './client'
import { normalizeUser, toIsoString, toNumber } from './normalize'

export interface Post {
  id: string
  content: string
  imageUrls?: string[]
  videoUrls?: string[]
  documentUrls?: string[]
  mediaUrls?: string[]
  images?: string[]
  privacy: string
  authorId: string
  author?: { id: string; displayName: string; avatar?: string; username: string }
  groupId?: string
  groupName?: string
  groupCoverUrl?: string
  likesCount: number
  commentsCount: number
  sharesCount: number
  isLiked?: boolean
  isSaved?: boolean
  isShared?: boolean
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  content: string
  postId: string
  parentId?: string
  authorId: string
  author?: { id: string; displayName: string; avatar?: string }
  likesCount: number
  isLiked?: boolean
  createdAt: string
}

export interface ReactionUser {
  id: string
  displayName: string
  avatar?: string
  username: string
}

function isCloudinaryImageUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('https://res.cloudinary.com/') &&
    url.includes('/image/upload/')
  )
}

function isCloudinaryVideoUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('https://res.cloudinary.com/') &&
    url.includes('/video/upload/')
  )
}

function isCloudinaryRawUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('https://res.cloudinary.com/') &&
    url.includes('/raw/upload/')
  )
}

function normalizePost(raw: any): Post {
  const author = raw.author ? normalizeUser(raw.author) : null
  const legacyMediaUrls: string[] = (raw.mediaUrls ?? raw.images ?? []).filter(
    (url: unknown): url is string => typeof url === 'string' && url.length > 0
  )
  const imageUrls: string[] = (raw.imageUrls ?? []).filter(
    (url: unknown): url is string => typeof url === 'string' && url.length > 0
  )
  const videoUrls: string[] = (raw.videoUrls ?? []).filter(
    (url: unknown): url is string => typeof url === 'string' && url.length > 0
  )
  const documentUrls: string[] = (raw.documentUrls ?? []).filter(
    (url: unknown): url is string => typeof url === 'string' && url.length > 0
  )

  for (const url of legacyMediaUrls) {
    if (isCloudinaryImageUrl(url) || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url)) imageUrls.push(url)
    else if (isCloudinaryVideoUrl(url) || /\.(mp4|webm|mov|mkv)(\?|$)/i.test(url)) videoUrls.push(url)
    else if (isCloudinaryRawUrl(url) || /\.(pdf|docx?|xlsx?|pptx?|txt|zip|rar)(\?|$)/i.test(url)) documentUrls.push(url)
  }

  const dedupImageUrls = Array.from(new Set(imageUrls))
  const dedupVideoUrls = Array.from(new Set(videoUrls))
  const dedupDocumentUrls = Array.from(new Set(documentUrls))
  const mediaUrls = [...dedupImageUrls, ...dedupVideoUrls]
  return {
    id: raw.postId ?? raw.id,
    content: raw.content ?? '',
    imageUrls: dedupImageUrls,
    videoUrls: dedupVideoUrls,
    documentUrls: dedupDocumentUrls,
    mediaUrls,
    images: dedupImageUrls,
    privacy: raw.visibility ?? raw.privacy ?? 'PUBLIC',
    authorId: raw.author?.userId ?? raw.authorId ?? '',
    author: author
      ? {
          id: author.id,
          displayName: author.displayName,
          avatar: author.avatar,
          username: author.username,
        }
      : undefined,
    groupId: raw.groupId && raw.groupId !== 'null' ? raw.groupId : undefined,
    groupName: raw.groupName ?? undefined,
    groupCoverUrl: raw.groupCoverUrl ?? undefined,
    likesCount: toNumber(raw.likesCount),
    commentsCount: toNumber(raw.commentsCount),
    sharesCount: toNumber(raw.sharesCount),
    isLiked: !!raw.isLiked,
    isSaved: !!raw.isSaved,
    isShared: !!raw.isShared,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  }
}

function normalizeComment(raw: any): Comment {
  const author = raw.author ? normalizeUser(raw.author) : null
  return {
    id: raw.commentId ?? raw.id,
    content: raw.content ?? '',
    postId: raw.postId ?? '',
    parentId: raw.parentId ?? undefined,
    authorId: raw.author?.userId ?? raw.authorId ?? '',
    author: author
      ? {
          id: author.id,
          displayName: author.displayName,
          avatar: author.avatar,
        }
      : undefined,
    likesCount: toNumber(raw.likesCount),
    isLiked: !!raw.isLiked,
    createdAt: toIsoString(raw.createdAt),
  }
}

export const postsApi = {
  getFeed: async (page = 1, limit = 10) => {
    const res = await apiClient.get<ApiResponse<any[]>>('/posts', { params: { page, limit } })
    return { ...res.data, data: (res.data.data ?? []).map(normalizePost) }
  },

  createPost: async (data: {
    content: string
    imageUrls?: string[]
    videoUrls?: string[]
    documentUrls?: string[]
    images?: string[]
    privacy?: string
    groupId?: string
  }) => {
    const imageUrls = data.imageUrls ?? data.images
    const payload = {
      content: data.content,
      imageUrls,
      videoUrls: data.videoUrls,
      documentUrls: data.documentUrls,
      visibility: data.privacy,
      groupId: data.groupId,
    }
    const res = await apiClient.post<ApiResponse<any>>('/posts', payload)
    return normalizePost(res.data.data)
  },

  getPost: async (id: string) => {
    const res = await apiClient.get<ApiResponse<any>>(`/posts/${id}`)
    return normalizePost(res.data.data)
  },

  updatePost: async (
    id: string,
    data: Partial<{ content: string; imageUrls: string[]; videoUrls: string[]; documentUrls: string[]; images: string[]; privacy: string }>
  ) => {
    const imageUrls = data.imageUrls ?? data.images
    const payload = {
      content: data.content,
      imageUrls,
      videoUrls: data.videoUrls,
      documentUrls: data.documentUrls,
      visibility: data.privacy,
    }
    const res = await apiClient.put<ApiResponse<any>>(`/posts/${id}`, payload)
    return normalizePost(res.data.data)
  },

  deletePost: (id: string) => apiClient.delete(`/posts/${id}`),

  toggleLike: (id: string) =>
    apiClient.post<ApiResponse<{ liked: boolean; likesCount: unknown }>>(`/posts/${id}/like`).then(r => ({
      liked: !!r.data.data?.liked,
      likesCount: toNumber(r.data.data?.likesCount),
    })),

  toggleSave: (id: string) =>
    apiClient.post<ApiResponse<{ saved: boolean }>>(`/posts/${id}/save`).then(r => r.data.data),

  sharePost: (id: string) =>
    apiClient.post<ApiResponse<{ shared: boolean; sharesCount: unknown }>>(`/posts/${id}/share`).then(r => ({
      shared: !!r.data.data?.shared,
      sharesCount: toNumber(r.data.data?.sharesCount),
    })),

  getSavedPosts: async (page = 1) => {
    const res = await apiClient.get<ApiResponse<any[]>>('/posts/saved', { params: { page } })
    return { ...res.data, data: (res.data.data ?? []).map(normalizePost) }
  },

  getUserPosts: async (userId: string, page = 1) => {
    const res = await apiClient.get<ApiResponse<any[]>>(`/posts/user/${userId}`, { params: { page } })
    return { ...res.data, data: (res.data.data ?? []).map(normalizePost) }
  },

  getGroupPosts: async (groupId: string, page = 1, limit = 10) => {
    const res = await apiClient.get<ApiResponse<any[]>>(`/posts/group/${groupId}`, { params: { page, limit } })
    return { ...res.data, data: (res.data.data ?? []).map(normalizePost) }
  },

  getComments: async (postId: string, page = 1) => {
    const res = await apiClient.get<ApiResponse<any[]>>(`/comments/${postId}`, { params: { page } })
    return (res.data.data ?? []).map(normalizeComment)
  },

  createComment: async (postId: string, data: { content: string; parentId?: string }) => {
    const res = await apiClient.post<ApiResponse<any>>(`/comments/${postId}`, data)
    return normalizeComment(res.data.data)
  },

  getPostIdByComment: async (commentId: string) => {
    const res = await apiClient.get<ApiResponse<{ postId: string | null }>>(`/comments/post-id/${commentId}`)
    return res.data.data?.postId ?? null
  },

  deleteComment: (commentId: string) => apiClient.delete(`/comments/${commentId}`),

  toggleCommentLike: (commentId: string) =>
    apiClient
      .post<ApiResponse<{ liked: boolean; likesCount: unknown }>>(`/comments/${commentId}/like`)
      .then(r => ({
        liked: !!r.data.data?.liked,
        likesCount: toNumber(r.data.data?.likesCount),
      })),

  getReactions: async (postId: string): Promise<ReactionUser[]> => {
    const res = await apiClient.get<ApiResponse<any[]>>(`/posts/${postId}/reactions`)
    return (res.data.data ?? []).map(raw => {
      const user = normalizeUser(raw)
      return {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        username: user.username,
      }
    })
  },
}
