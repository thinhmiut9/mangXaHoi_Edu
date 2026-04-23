import { apiClient, ApiResponse } from './client'
import { normalizeUser, toIsoString, toNumber } from './normalize'

export interface Group {
  id: string
  name: string
  description?: string
  coverUrl?: string
  coverPhoto?: string
  privacy: 'PUBLIC' | 'PRIVATE'
  status: 'ACTIVE' | 'ARCHIVED'
  ownerId: string
  membersCount: number
  isMember?: boolean
  isOwner?: boolean
  isJoinRequested?: boolean
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: string
  type: string
  message: string
  isRead: boolean
  senderId: string
  entityId?: string
  entityType?: string
  sender?: { displayName: string; avatar?: string }
  createdAt: string
}

export interface Conversation {
  id: string
  isGroup: boolean
  name?: string
  avatarUrl?: string
  creatorId?: string
  participants: Array<{ id: string; displayName: string; avatar?: string }>
  lastMessage?: { content: string; createdAt: string; senderId?: string; type?: string }
  unreadCount: number
  updatedAt: string
  requestStatus?: 'PENDING' | 'ACCEPTED'
  requesterId?: string
}

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'LINK'

export interface Message {
  id: string
  conversationId: string
  senderId: string
  sender?: { displayName: string; avatar?: string }
  content: string
  type: MessageType
  mediaUrl?: string       // URL Cloudinary
  fileName?: string       // Tên file (dành cho FILE)
  fileSize?: number       // Byte
  mimeType?: string       // VD: image/png, video/mp4, application/pdf
  thumbnailUrl?: string   // Thumbnail cho VIDEO
  readBy: string[]
  createdAt: string
}

export interface GroupJoinRequest {
  requester: {
    id: string
    displayName: string
    avatar?: string
    username: string
  }
  requestedAt: string
}

function normalizeGroup(raw: any): Group {
  return {
    id: raw.groupId ?? raw.id,
    name: raw.name ?? '',
    description: raw.description,
    coverUrl: raw.coverUrl,
    coverPhoto: raw.coverUrl ?? raw.coverPhoto,
    privacy: raw.privacy ?? 'PUBLIC',
    status: raw.status ?? 'ACTIVE',
    ownerId: raw.owner?.userId ?? raw.ownerId ?? '',
    membersCount: toNumber(raw.membersCount),
    isMember: !!raw.isMember,
    isOwner: !!raw.isOwner,
    isJoinRequested: !!raw.isJoinRequested,
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  }
}

function normalizeVietnameseNotificationMessage(input: string): string {
  if (!input) return ''
  const text = input.trim()

  const exactMap: Record<string, string> = {
    'da gui cho ban mot tin nhan moi.': 'đã gửi cho bạn một tin nhắn mới.',
    'da gui cho ban mot loi moi ket ban.': 'đã gửi cho bạn một lời mời kết bạn.',
    'da chap nhan loi moi ket ban cua ban.': 'đã chấp nhận lời mời kết bạn của bạn.',
    'vua dang mot bai viet moi.': 'vừa đăng một bài viết mới.',
    'da thich bai viet cua ban.': 'đã thích bài viết của bạn.',
    'da binh luan bai viet cua ban.': 'đã bình luận bài viết của bạn.',
    'da tha cam xuc cho binh luan cua ban.': 'đã thả cảm xúc cho bình luận của bạn.',
    'noi dung cua ban da bi xoa do vi pham.': 'nội dung của bạn đã bị xóa do vi phạm.',
    'tai khoan cua ban da bi khoa 24 gio do vi pham.': 'tài khoản của bạn đã bị khóa 24 giờ do vi phạm.',
    'tai khoan cua ban da bi khoa 7 ngay do vi pham.': 'tài khoản của bạn đã bị khóa 7 ngày do vi phạm.',
    'noi dung cua ban da bi danh dau vi pham va da duoc xu ly.': 'nội dung của bạn đã bị đánh dấu vi phạm và đã được xử lý.',
  }

  const lower = text.toLowerCase()
  if (exactMap[lower]) return exactMap[lower]

  return text
}

function normalizeNotification(raw: any): Notification {
  return {
    id: raw.notificationId ?? raw.id,
    type: raw.type ?? '',
    message: normalizeVietnameseNotificationMessage(raw.content ?? raw.message ?? ''),
    isRead: !!raw.isRead,
    senderId: raw.sender?.userId ?? raw.senderId ?? '',
    entityId: raw.entityId,
    entityType: raw.entityType,
    sender: raw.sender
      ? { displayName: raw.sender.displayName ?? '', avatar: raw.sender.avatarUrl ?? raw.sender.avatar }
      : undefined,
    createdAt: toIsoString(raw.createdAt),
  }
}

function normalizeConversation(raw: any): Conversation {
  return {
    id: raw.conversationId ?? raw.id,
    isGroup: raw.type === 'GROUP' || !!raw.isGroup,
    name: raw.name,
    avatarUrl: raw.avatarUrl,
    creatorId: raw.creatorId,
    participants: (raw.participants ?? []).map((p: any) => ({
      id: p.userId ?? p.id ?? '',
      displayName: p.displayName ?? '',
      avatar: p.avatarUrl ?? p.avatar,
    })),
    lastMessage: raw.lastMessage
      ? { 
          content: raw.lastMessage.content ?? '', 
          createdAt: toIsoString(raw.lastMessage.createdAt),
          senderId: raw.lastMessage.senderId,
          type: raw.lastMessage.type,
        }
      : undefined,
    unreadCount: toNumber(raw.unreadCount),
    updatedAt: toIsoString(raw.updatedAt),
    requestStatus: raw.requestStatus,
    requesterId: raw.requesterId,
  }
}

function normalizeMessage(raw: any): Message {
  return {
    id: raw.messageId ?? raw.id,
    conversationId: raw.conversationId ?? '',
    senderId: raw.sender?.userId ?? raw.senderId ?? '',
    sender: raw.sender
      ? { displayName: raw.sender.displayName ?? '', avatar: raw.sender.avatarUrl ?? raw.sender.avatar }
      : undefined,
    content: raw.content ?? '',
    type: raw.type ?? 'TEXT',
    mediaUrl: raw.mediaUrl ?? undefined,
    fileName: raw.fileName ?? undefined,
    fileSize: raw.fileSize ?? undefined,
    mimeType: raw.mimeType ?? undefined,
    thumbnailUrl: raw.thumbnailUrl ?? undefined,
    readBy: raw.readBy ?? [],
    createdAt: toIsoString(raw.createdAt),
  }
}

export const groupsApi = {
  list: () => apiClient.get<ApiResponse<any[]>>('/groups').then(r => (r.data.data ?? []).map(normalizeGroup)),
  getMyGroups: () => apiClient.get<ApiResponse<any[]>>('/groups/my').then(r => (r.data.data ?? []).map(normalizeGroup)),
  getGroup: (id: string) => apiClient.get<ApiResponse<any>>(`/groups/${id}`).then(r => normalizeGroup(r.data.data)),
  createGroup: (data: { name: string; description?: string; coverUrl?: string; privacy?: string }) =>
    apiClient.post<ApiResponse<any>>('/groups', data).then(r => normalizeGroup(r.data.data)),
  updateGroup: (id: string, data: { name?: string; description?: string; coverUrl?: string; privacy?: string; status?: 'ACTIVE' | 'ARCHIVED' }) =>
    apiClient.put<ApiResponse<any>>(`/groups/${id}`, data).then(r => normalizeGroup(r.data.data)),
  join: (id: string) =>
    apiClient
      .post<ApiResponse<{ status: 'JOINED' | 'REQUESTED' }>>(`/groups/${id}/join`)
      .then(r => ({ status: r.data.data?.status ?? 'JOINED', message: r.data.message ?? '' })),
  leave: (id: string) => apiClient.delete(`/groups/${id}/leave`),
  getMembers: (id: string) => apiClient.get(`/groups/${id}/members`).then(r => r.data),
  removeMember: (id: string, userId: string) => apiClient.delete(`/groups/${id}/members/${userId}`),
  getJoinRequests: (id: string): Promise<GroupJoinRequest[]> =>
    apiClient.get<ApiResponse<any[]>>(`/groups/${id}/requests`).then(r =>
      (r.data.data ?? []).map((raw: any) => {
        const user = normalizeUser(raw.requester)
        return {
          requester: {
            id: user.id,
            displayName: user.displayName,
            avatar: user.avatar,
            username: user.username,
          },
          requestedAt: toIsoString(raw.requestedAt),
        }
      })
    ),
  approveJoinRequest: (id: string, userId: string) => apiClient.put(`/groups/${id}/requests/${userId}/approve`),
  rejectJoinRequest: (id: string, userId: string) => apiClient.delete(`/groups/${id}/requests/${userId}/reject`),
}

export const notificationsApi = {
  list: (page = 1) =>
    apiClient.get<ApiResponse<any[]>>('/notifications', { params: { page } }).then(r => (r.data.data ?? []).map(normalizeNotification)),
  markRead: (id: string) => apiClient.put(`/notifications/${id}/read`),
  markAllRead: () => apiClient.put('/notifications/read-all'),
  deleteById: (id: string) => apiClient.delete(`/notifications/${id}`),
  getUnreadCount: () =>
    apiClient.get<ApiResponse<{ count: unknown }>>('/notifications/unread-count').then(r => toNumber(r.data.data.count)),
  getUnreadSummary: () =>
    apiClient
      .get<ApiResponse<{ notificationCount: unknown; messageCount: unknown }>>('/notifications/unread-summary')
      .then(r => ({
        notificationCount: toNumber(r.data.data.notificationCount),
        messageCount: toNumber(r.data.data.messageCount),
      })),
}

export const chatApi = {
  getConversations: () =>
    apiClient.get<ApiResponse<any[]>>('/chat/conversations').then(r => (r.data.data ?? []).map(normalizeConversation)),
  getOrCreateConversation: (targetId: string) =>
    apiClient.post<ApiResponse<any>>('/chat/conversations', { targetId }).then(r => normalizeConversation(r.data.data)),
  createGroupConversation: (name: string, participantIds: string[], avatarUrl?: string) =>
    apiClient.post<ApiResponse<any>>('/chat/conversations/group', { name, participantIds, avatarUrl }).then(r => normalizeConversation(r.data.data)),
  getMessages: (conversationId: string, page = 1) =>
    apiClient.get<ApiResponse<any[]>>(`/chat/conversations/${conversationId}/messages`, { params: { page } }).then(r => (r.data.data ?? []).map(normalizeMessage)),
  getMediaMessages: (conversationId: string) =>
    apiClient.get<ApiResponse<any[]>>(`/chat/conversations/${conversationId}/media`).then(r => (r.data.data ?? []).map(normalizeMessage)),
  sendMessage: (conversationId: string, content: string, media?: {
    type?: MessageType
    mediaUrl?: string
    fileName?: string
    fileSize?: number
    mimeType?: string
    thumbnailUrl?: string
  }) =>
    apiClient.post<ApiResponse<any>>(`/chat/conversations/${conversationId}/messages`, { content, ...media }).then(r => normalizeMessage(r.data.data)),
  markConversationRead: (conversationId: string) =>
    apiClient.put(`/chat/conversations/${conversationId}/read`),
  deleteConversation: (conversationId: string) =>
    apiClient.delete(`/chat/conversations/${conversationId}`),
  acceptMessageRequest: (conversationId: string) =>
    apiClient.put(`/chat/conversations/${conversationId}/accept`),
  getConversationMeta: (conversationId: string): Promise<{ requestStatus: string; requesterId: string | null }> =>
    apiClient.get<ApiResponse<any>>(`/chat/conversations/${conversationId}/meta`).then(r => r.data.data ?? { requestStatus: 'ACCEPTED', requesterId: null }),
  getGroupInfo: (conversationId: string) =>
    apiClient.get<ApiResponse<any>>(`/chat/conversations/${conversationId}/group-info`).then(r => r.data.data as { name: string; avatarUrl?: string; creatorId: string } | null),
  updateGroupInfo: (conversationId: string, data: { name?: string; avatarUrl?: string }) =>
    apiClient.put(`/chat/conversations/${conversationId}/group-info`, data),
}

export const reportsApi = {
  create: (data: { targetId: string; targetType: string; reason: string; description?: string }) =>
    apiClient.post('/reports', data),
}

export const uploadsApi = {
  uploadImage: (file: File, folder?: 'images' | 'posts' | 'stories' | 'covers') => {
    const form = new FormData()
    form.append('image', file)
    if (folder) form.append('folder', folder)
    return apiClient.post<ApiResponse<{ url: string; publicId: string }>>('/uploads/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data)
  },
  uploadAvatar: (file: File) => {
    const form = new FormData(); form.append('avatar', file)
    return apiClient.post<ApiResponse<{ url: string; publicId: string }>>('/uploads/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data)
  },
  uploadVideo: (file: File, folder?: 'stories' | 'posts') => {
    const form = new FormData()
    form.append('video', file)
    if (folder) form.append('folder', folder)
    return apiClient.post<ApiResponse<{ url: string; publicId: string }>>('/uploads/video', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data)
  },
  uploadDocument: (file: File) => {
    const form = new FormData(); form.append('document', file)
    return apiClient.post<ApiResponse<{ url: string; publicId: string }>>('/uploads/document', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data.data)
  },
}

export const adminApi = {
  getDashboard: () =>
    apiClient.get<ApiResponse<any>>('/admin/dashboard').then(r => r.data.data),
  listUsers: (page = 1, search?: string, limit = 20) =>
    apiClient.get<ApiResponse<any[]>>('/admin/users', { params: { page, limit, search } }).then(r => r.data.data ?? []),
  getUserDetail: (id: string) =>
    apiClient.get<ApiResponse<any>>(`/admin/users/${id}`).then(r => r.data.data),
  blockUser: (id: string) => apiClient.put(`/admin/users/${id}/block`),
  unblockUser: (id: string) => apiClient.put(`/admin/users/${id}/unblock`),
  listReports: (status?: string, page = 1, limit = 20) =>
    apiClient.get<ApiResponse<any[]>>('/reports', { params: { status, page, limit } }).then(r => r.data.data ?? []),
  getReportDetail: (id: string) =>
    apiClient.get<ApiResponse<any>>(`/reports/${id}`).then(r => r.data.data),
  updateReport: (
    id: string,
    payload: {
      status: 'RESOLVED' | 'REJECTED'
      action?: 'MARK_ONLY' | 'HIDE_CONTENT' | 'LOCK_24H' | 'LOCK_7D'
      note?: string
      notifyReporter?: boolean
    }
  ) => apiClient.put(`/reports/${id}`, payload),
}
