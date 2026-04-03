// ============================================================
// Shared domain types — aligned with actual Neo4j DB schema
// ============================================================

export type UserRole = 'USER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'BLOCKED'
export type ProfileVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE'
export type FriendStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type GroupPrivacy = 'PUBLIC' | 'PRIVATE'
export type GroupStatus = 'ACTIVE' | 'ARCHIVED'
export type PostVisibility = 'PUBLIC' | 'FRIENDS' | 'GROUP' | 'PRIVATE'
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'REJECTED'
export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'POST_REACT'
  | 'POST_COMMENT'
  | 'MESSAGE'
  | 'NEW_POST'
  | 'GROUP_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'GROUP_INVITE'
  | 'ADMIN_ACTION'

// ────────────────────────────────────────────
// User (Node: User)
// ────────────────────────────────────────────
export interface User {
  userId: string
  email: string
  passwordHash: string
  displayName: string
  bio?: string
  avatarUrl?: string
  coverUrl?: string
  location?: string
  status: UserStatus
  role: UserRole
  profileVisibility: ProfileVisibility
  createdAt: string
  updatedAt: string
  blockedUntil?: string
  lastOnlineAt?: string
}

/** Public-facing user fields (no password) */
export interface UserPublic {
  userId: string
  email: string
  displayName: string
  bio?: string
  avatarUrl?: string
  coverUrl?: string
  location?: string
  role: UserRole
  status: UserStatus
  profileVisibility: ProfileVisibility
  createdAt: string
  lastOnlineAt?: string
}

// ────────────────────────────────────────────
// Post (Node: Post)
// ────────────────────────────────────────────
export interface Post {
  postId: string
  content: string
  mediaUrls?: string[]
  visibility: PostVisibility
  author?: UserPublic
  groupId?: string          // resolved from relationship
  groupName?: string
  groupCoverUrl?: string
  likesCount: number        // computed
  commentsCount: number     // computed
  sharesCount: number       // computed
  isLiked?: boolean
  isSaved?: boolean
  isShared?: boolean
  createdAt: string
  updatedAt: string
}

// ────────────────────────────────────────────
// Comment (Node: Comment)
// ────────────────────────────────────────────
export interface Comment {
  commentId: string
  content: string
  author?: UserPublic
  postId?: string           // resolved from relationship
  parentId?: string         // for nested comments
  likesCount: number        // computed
  isLiked?: boolean
  createdAt: string
  updatedAt: string
}

// ────────────────────────────────────────────
// Group (Node: Group)
// ────────────────────────────────────────────
export interface Group {
  groupId: string
  name: string
  description?: string
  coverUrl?: string
  privacy: GroupPrivacy
  status: GroupStatus
  owner?: UserPublic
  membersCount?: number     // computed
  isMember?: boolean
  isOwner?: boolean
  createdAt: string
  updatedAt: string
}

// ────────────────────────────────────────────
// Conversation (Node: Conversation)
// ────────────────────────────────────────────
export interface Conversation {
  conversationId: string
  type: 'DIRECT' | 'GROUP'
  participants?: UserPublic[]
  lastMessage?: Message
  unreadCount?: number
  createdAt: string
  updatedAt: string
  lastMessageAt?: string
}

// ────────────────────────────────────────────
// Message (Node: Message)
// ────────────────────────────────────────────
export interface Message {
  messageId: string
  content: string
  type: 'TEXT' | 'IMAGE'
  mediaUrl?: string
  sender?: UserPublic
  conversationId?: string   // resolved from relationship
  createdAt: string
}

// ────────────────────────────────────────────
// Notification (Node: Notification)
// ────────────────────────────────────────────
export interface Notification {
  notificationId: string
  type: NotificationType
  content: string
  isRead: boolean
  senderId?: string
  entityId?: string
  entityType?: string
  sender?: UserPublic
  recipientId?: string      // resolved from relationship
  createdAt: string
}

// ────────────────────────────────────────────
// Report (Node: Report)
// ────────────────────────────────────────────
export interface Report {
  reportId: string
  reason: string
  description?: string
  status: ReportStatus
  reporter?: UserPublic
  targetId?: string         // resolved from TARGETS relationship
  targetType?: string
  target?: {
    targetId: string
    targetType: string
    content?: string
    name?: string
    avatarUrl?: string
    mediaUrls?: string[]
    visibility?: string
    createdAt?: string
    author?: UserPublic
    group?: {
      groupId?: string
      name?: string
      coverUrl?: string
    }
  }
  createdAt: string
  resolvedAt?: string
}

// ────────────────────────────────────────────
// Story (Node: Story)
// ────────────────────────────────────────────
export interface Story {
  storyId: string
  type: 'IMAGE' | 'VIDEO'
  mediaUrl: string
  content?: string
  isActive: boolean
  author?: UserPublic
  createdAt: string
  expiresAt: string
}

// ────────────────────────────────────────────
// Shared
// ────────────────────────────────────────────
export interface PaginationQuery {
  page?: number
  limit?: number
}
