import { apiClient, ApiResponse } from './client'
import { User } from './auth'
import { normalizeUser, toIsoString, toNumber } from './normalize'
import { Group } from './index'
import { Post } from './posts'

export const usersApi = {
  getProfile: (id: string) =>
    apiClient.get<ApiResponse<any>>(`/users/${id}`).then(r => {
      const u = normalizeUser(r.data.data)
      return {
        ...u,
        postsCount: toNumber(r.data.data?.postsCount),
        friendsCount: toNumber(r.data.data?.friendsCount),
        groupsCount: toNumber(r.data.data?.groupsCount),
        isOwnProfile: !!r.data.data?.isOwnProfile,
      }
    }),

  getProfileByUsername: (username: string) =>
    apiClient.get<ApiResponse<any>>(`/users/username/${username}`).then(r => normalizeUser(r.data.data)),

  getUserFriends: (id: string) =>
    apiClient.get<ApiResponse<any[]>>(`/users/${id}/friends`).then(r => (r.data.data ?? []).map(normalizeUser)),

  updateProfile: (data: { displayName?: string; bio?: string; avatar?: string; coverPhoto?: string; location?: string; profileVisibility?: 'PUBLIC' | 'FRIENDS' | 'PRIVATE' }) =>
    apiClient.put<ApiResponse<any>>('/users/me', {
      displayName: data.displayName,
      bio: data.bio,
      avatarUrl: data.avatar,
      coverUrl: data.coverPhoto,
      location: data.location,
      profileVisibility: data.profileVisibility,
    }).then(r => normalizeUser(r.data.data)),

  searchUsers: (q: string, page = 1) =>
    apiClient.get<ApiResponse<any[]>>('/users/search', { params: { q, page } }).then(r => ({
      ...r.data,
      data: (r.data.data ?? []).map(normalizeUser),
    })),

  mentionSearch: (q: string, limit = 8): Promise<{ userId: string; displayName: string; avatarUrl?: string }[]> =>
    apiClient
      .get<ApiResponse<{ userId: string; displayName: string; avatarUrl?: string }[]>>('/users/mention-search', { params: { q, limit } })
      .then(r => r.data.data ?? []),

  searchAll: (q: string, limit = 12) =>
    apiClient
      .get<ApiResponse<{ users: any[]; posts: any[]; groups: any[] }>>('/users/search-all', { params: { q, limit } })
      .then(r => {
        const payload = r.data.data ?? { users: [], posts: [], groups: [] }
        return {
          users: (payload.users ?? []).map(normalizeUser),
          posts: (payload.posts ?? []).map((raw: any): Post => {
            const author = raw.author ? normalizeUser(raw.author) : null
            const imageUrls = (raw.imageUrls ?? raw.mediaUrls ?? raw.images ?? []).filter((url: unknown): url is string => typeof url === 'string')
            const videoUrls = (raw.videoUrls ?? []).filter((url: unknown): url is string => typeof url === 'string')
            const documentUrls = (raw.documentUrls ?? []).filter((url: unknown): url is string => typeof url === 'string')
            return {
              id: raw.postId ?? raw.id,
              content: raw.content ?? '',
              imageUrls,
              videoUrls,
              documentUrls,
              mediaUrls: [...imageUrls, ...videoUrls],
              images: imageUrls,
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
          }),
          groups: (payload.groups ?? []).map((raw: any): Group => ({
            id: raw.groupId ?? raw.id,
            name: raw.name ?? '',
            description: raw.description ?? '',
            coverUrl: raw.coverUrl ?? '',
            coverPhoto: raw.coverUrl ?? raw.coverPhoto ?? '',
            privacy: raw.privacy ?? 'PUBLIC',
            status: raw.status ?? 'ACTIVE',
            ownerId: raw.owner?.userId ?? raw.ownerId ?? '',
            membersCount: toNumber(raw.membersCount),
            isMember: !!raw.isMember,
            isOwner: !!raw.isOwner,
            isJoinRequested: !!raw.isJoinRequested,
            createdAt: toIsoString(raw.createdAt),
            updatedAt: toIsoString(raw.updatedAt),
          })),
        }
      }),
}

export const friendsApi = {
  getFriends: () =>
    apiClient.get<ApiResponse<any[]>>('/friends').then(r => (r.data.data ?? []).map(normalizeUser) as User[]),

  getRequests: () =>
    apiClient.get<ApiResponse<any[]>>('/friends/requests').then(r => (r.data.data ?? []).map(normalizeUser) as User[]),

  getSentRequests: () =>
    apiClient.get<ApiResponse<any[]>>('/friends/requests/sent').then(r => (r.data.data ?? []).map(normalizeUser) as User[]),

  getSuggestions: () =>
    apiClient.get<ApiResponse<any[]>>('/friends/suggestions').then(r => (r.data.data ?? []).map(normalizeUser) as User[]),

  getBlockedUsers: () =>
    apiClient.get<ApiResponse<any[]>>('/friends/blocked').then(r => (r.data.data ?? []).map(normalizeUser) as User[]),

  sendRequest: (userId: string) =>
    apiClient.post(`/friends/request/${userId}`),

  blockUser: (userId: string) =>
    apiClient.post(`/friends/block/${userId}`),

  unblockUser: (userId: string) =>
    apiClient.delete(`/friends/block/${userId}`),

  cancelRequest: (userId: string) =>
    apiClient.delete(`/friends/request/${userId}`),

  acceptRequest: (userId: string) =>
    apiClient.put(`/friends/accept/${userId}`),

  rejectRequest: (userId: string) =>
    apiClient.delete(`/friends/reject/${userId}`),

  unfriend: (userId: string) =>
    apiClient.delete(`/friends/${userId}`),
}
