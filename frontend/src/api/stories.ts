import { apiClient, ApiResponse } from './client'
import { normalizeUser, toIsoString } from './normalize'

export interface Story {
  id: string
  type: 'IMAGE' | 'VIDEO'
  mediaUrl: string
  content?: string
  isActive: boolean
  isViewed?: boolean
  createdAt: string
  expiresAt: string
  author: {
    id: string
    displayName: string
    avatar?: string
    username: string
  }
}

export interface StoryViewer {
  user: {
    id: string
    displayName: string
    avatar?: string
    username: string
  }
  viewedAt: string
}

function isCloudinaryVideoUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('https://res.cloudinary.com/') &&
    url.includes('/video/upload/')
  )
}

function isCloudinaryImageUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.startsWith('https://res.cloudinary.com/') &&
    url.includes('/image/upload/')
  )
}

function normalizeStory(raw: any): Story {
  const author = normalizeUser(raw.author)
  return {
    id: raw.storyId ?? raw.id,
    type: raw.type === 'IMAGE' ? 'IMAGE' : 'VIDEO',
    mediaUrl: (isCloudinaryVideoUrl(raw.mediaUrl) || isCloudinaryImageUrl(raw.mediaUrl)) ? raw.mediaUrl : '',
    content: raw.content ?? undefined,
    isActive: !!raw.isActive,
    isViewed: !!raw.isViewed,
    createdAt: toIsoString(raw.createdAt),
    expiresAt: toIsoString(raw.expiresAt),
    author: {
      id: author.id,
      displayName: author.displayName,
      avatar: author.avatar,
      username: author.username,
    },
  }
}

export const storiesApi = {
  getFeed: async () => {
    const res = await apiClient.get<ApiResponse<any[]>>('/stories')
    return (res.data.data ?? []).map(normalizeStory).filter(item => !!item.mediaUrl)
  },

  createStory: async (data: { type: 'IMAGE' | 'VIDEO'; mediaUrl: string; content?: string }) => {
    const res = await apiClient.post<ApiResponse<any>>('/stories', data)
    return normalizeStory(res.data.data)
  },

  getStory: async (storyId: string) => {
    const res = await apiClient.get<ApiResponse<any>>(`/stories/${storyId}`)
    return normalizeStory(res.data.data)
  },

  markViewed: async (storyId: string) => {
    await apiClient.post(`/stories/${storyId}/view`)
  },

  getViewers: async (storyId: string): Promise<StoryViewer[]> => {
    const res = await apiClient.get<ApiResponse<any[]>>(`/stories/${storyId}/viewers`)
    return (res.data.data ?? []).map((raw: any) => {
      const viewer = normalizeUser(raw.viewer)
      return {
        user: {
          id: viewer.id,
          displayName: viewer.displayName,
          avatar: viewer.avatar,
          username: viewer.username,
        },
        viewedAt: toIsoString(raw.viewedAt),
      }
    })
  },
}
