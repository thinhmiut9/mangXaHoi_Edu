import { usersRepository } from './users.repository'
import { AppError } from '../../middleware/errorHandler'
import { UpdateProfileDto } from './users.schema'
import { paginationMeta } from '../../utils/response'
import { UserPublic } from '../../types'
import { friendsRepository } from '../friends/friends.repository'
import { postsRepository } from '../posts/posts.repository'
import { groupsRepository } from '../groups/groups.repository'
import {
  filterCloudinaryImageUrls,
  filterCloudinaryMediaUrls,
  filterCloudinaryRawUrls,
  filterCloudinaryVideoUrls,
} from '../../utils/cloudinary'

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[a.length][b.length]
}

function scoreUser(user: UserPublic, keywordNorm: string): number {
  const fields = [user.displayName, user.email, user.location ?? '']
    .map(v => normalizeForSearch(v))
    .filter(Boolean)

  const kwWords = keywordNorm.split(/\s+/).filter(Boolean)

  let best = 0
  for (const field of fields) {
    // Full phrase match
    if (field === keywordNorm) return 100
    if (field.startsWith(keywordNorm)) { best = Math.max(best, 95); continue }
    if (field.includes(keywordNorm)) { best = Math.max(best, 85); continue }

    // All keyword words must appear somewhere in the field
    const allWordsMatch = kwWords.every(kw => field.includes(kw))
    if (allWordsMatch && kwWords.length > 1) { best = Math.max(best, 80); continue }

    // At least one keyword word matches a field word (exact or prefix)
    const fieldWords = field.split(/\s+/).filter(Boolean)
    for (const kw of kwWords) {
      for (const fw of fieldWords) {
        if (fw === kw) best = Math.max(best, 70)
        else if (fw.startsWith(kw) && kw.length >= 2) best = Math.max(best, 60)
      }
    }
  }
  return best
}

function scoreMentionUser(user: UserPublic, keywordNorm: string): number {
  const raw = user as UserPublic & { username?: string }
  const fields = [
    { value: raw.displayName, weight: 0 },
    { value: raw.username ?? '', weight: -5 },
    { value: raw.email, weight: -15 },
  ]
    .map(field => ({ ...field, value: normalizeForSearch(field.value) }))
    .filter(field => field.value)

  let best = 0
  for (const field of fields) {
    const words = field.value.split(/\s+/).filter(Boolean)

    if (field.value === keywordNorm) best = Math.max(best, 120 + field.weight)
    if (field.value.startsWith(keywordNorm)) best = Math.max(best, 100 + field.weight)

    for (const word of words) {
      if (word === keywordNorm) best = Math.max(best, 115 + field.weight)
      if (word.startsWith(keywordNorm)) best = Math.max(best, 110 + field.weight)
      if (keywordNorm.length >= 2 && word.includes(keywordNorm)) best = Math.max(best, 85 + field.weight)
    }

    if (keywordNorm.length >= 2 && field.value.includes(keywordNorm)) {
      best = Math.max(best, 70 + field.weight)
    }

    // Fuzzy matching is useful for typos, but only after at least 3 chars.
    if (keywordNorm.length >= 3) {
      for (const word of words) {
        const maxLen = Math.max(word.length, keywordNorm.length)
        const similarity = 1 - levenshtein(word, keywordNorm) / maxLen
        if (similarity >= 0.78) best = Math.max(best, Math.round(similarity * 65) + field.weight)
      }
    }
  }

  return best
}

function isCloudinaryAvatarUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('https://res.cloudinary.com/') && value.includes('/image/upload/')
}

function toSafePositiveInt(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1
  if (typeof value === 'bigint') return value > 0n ? Number(value) : 1
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const parsed = (value as { toNumber?: () => number }).toNumber?.()
    return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

async function canViewPrivateContent(viewerId: string | undefined, ownerId: string): Promise<boolean> {
  if (!viewerId) return false
  if (viewerId === ownerId) return true
  const relation = await friendsRepository.getStatus(viewerId, ownerId)
  return relation.status === 'ACCEPTED'
}

async function ensurePrivateContentVisibleToViewer(
  profileVisibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE' | undefined,
  viewerId: string,
  ownerId: string
) {
  const visibility = profileVisibility ?? 'PUBLIC'
  if (visibility === 'PUBLIC') return

  const allowed = await canViewPrivateContent(viewerId, ownerId)
  if (!allowed) {
    throw new AppError('Ban khong co quyen xem ho so nay', 403, 'PROFILE_FRIENDS_ONLY')
  }
}

export const usersService = {
  async getProfile(userId: string, viewerId?: string) {
    const user = await usersRepository.findById(userId)
    if (!user || user.status === 'BLOCKED') {
      throw new AppError('Nguoi dung khong ton tai', 404, 'USER_NOT_FOUND')
    }
    const ownerId = user.userId

    if (viewerId && viewerId !== ownerId) {
      const blocked = await friendsRepository.isBlockedBetween(viewerId, ownerId)
      if (blocked) {
        throw new AppError('Nguoi dung khong ton tai', 404, 'USER_NOT_FOUND')
      }
    }

    const stats = await usersRepository.getStats(ownerId)
    const isOwnProfile = viewerId === ownerId
    const canViewPrivate = await canViewPrivateContent(viewerId, ownerId)
    return { ...sanitizeUser(user), ...stats, isOwnProfile, canViewPrivateContent: canViewPrivate }
  },

  async getProfileByUsername(username: string, viewerId?: string) {
    const user = await usersRepository.findByUsername(username)
    if (!user || user.status === 'BLOCKED') {
      throw new AppError('Nguoi dung khong ton tai', 404, 'USER_NOT_FOUND')
    }

    if (viewerId && viewerId !== user.userId) {
      const blocked = await friendsRepository.isBlockedBetween(viewerId, user.userId)
      if (blocked) {
        throw new AppError('Nguoi dung khong ton tai', 404, 'USER_NOT_FOUND')
      }
    }

    const stats = await usersRepository.getStats(user.userId)
    const isOwnProfile = viewerId === user.userId
    const canViewPrivate = await canViewPrivateContent(viewerId, user.userId)
    return { ...sanitizeUser(user), ...stats, isOwnProfile, canViewPrivateContent: canViewPrivate }
  },

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Normalize empty string → null for avatar/cover (deletion case)
    const normalized = {
      ...dto,
      avatarUrl: dto.avatarUrl === '' ? null : dto.avatarUrl,
      coverUrl: dto.coverUrl === '' ? null : dto.coverUrl,
    }
    const updated = await usersRepository.update(userId, normalized as any)
    if (!updated) throw new AppError('Cap nhat that bai', 500)
    return sanitizeUser(updated)
  },

  async getUserFriends(userId: string, viewerId?: string) {
    const user = await usersRepository.findById(userId)
    if (!user || user.status === 'BLOCKED') {
      throw new AppError('Nguoi dung khong ton tai', 404, 'USER_NOT_FOUND')
    }
    const ownerId = user.userId

    if (viewerId && viewerId !== ownerId) {
      const blocked = await friendsRepository.isBlockedBetween(viewerId, ownerId)
      if (blocked) {
        throw new AppError('Nguoi dung khong ton tai', 404, 'USER_NOT_FOUND')
      }
      const visibility = user.profileVisibility ?? 'PUBLIC'
      if (visibility === 'PRIVATE') {
        const allowed = await canViewPrivateContent(viewerId, ownerId)
        if (!allowed) return []
      } else {
        await ensurePrivateContentVisibleToViewer(user.profileVisibility, viewerId, ownerId)
      }
    }

    return friendsRepository.getFriends(ownerId, 0, 300)
  },

  async searchUsers(viewerId: string, q: string, page: number, limit: number) {
    const keyword = q.trim()
    if (!keyword) return { users: [], meta: paginationMeta(page, limit, 0) }

    const keywordNorm = normalizeForSearch(keyword)

    // Load all active users (no keyword filter — Neo4j CONTAINS can't strip diacritics)
    const totalCount = toSafePositiveInt(await usersRepository.countAll())
    const allUsers = await usersRepository.search('', totalCount, 0, viewerId)

    // Filter: keep users whose normalized fields include the normalized keyword
    const matched = allUsers.filter(user => {
      const fields = [user.displayName, user.email, user.location ?? ''].map(normalizeForSearch)
      return fields.some(f => f.includes(keywordNorm))
    })

    const skip = (page - 1) * limit
    const users = matched.slice(skip, skip + limit)
    return { users, meta: paginationMeta(page, limit, matched.length) }
  },

  async searchAll(viewerId: string, q: string, limit: number) {
    const keyword = q.trim()
    if (!keyword) return { users: [], posts: [], groups: [] }

    const userSearch = usersService.searchUsers(viewerId, keyword, 1, limit)
    const postSearch = postsRepository.searchVisiblePosts(viewerId, keyword, limit)
    const groupSearch = groupsRepository.searchVisibleGroups(viewerId, keyword, limit)

    const [usersResult, posts, groups] = await Promise.all([userSearch, postSearch, groupSearch])

    return {
      users: usersResult.users,
      posts: posts.map((post) => {
        const imageUrls = filterCloudinaryImageUrls(post.imageUrls)
        const videoUrls = filterCloudinaryVideoUrls(post.videoUrls)
        const documentUrls = filterCloudinaryRawUrls(post.documentUrls)
        const legacyMedia = filterCloudinaryMediaUrls(post.mediaUrls)
        return {
          ...post,
          imageUrls,
          videoUrls,
          documentUrls,
          mediaUrls: [...new Set([...imageUrls, ...videoUrls, ...legacyMedia])],
        }
      }),
      groups,
    }
  },

  async mentionSearch(viewerId: string, q: string, limit = 8) {
    const keyword = q.trim()
    if (!keyword) return []
    const keywordNorm = normalizeForSearch(keyword)
    const totalUsers = toSafePositiveInt(await usersRepository.countAll())
    const candidates = await usersRepository.search('', totalUsers, 0, viewerId)
    return candidates
      .map(user => ({ user, score: scoreMentionUser(user, keywordNorm) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.user.displayName.localeCompare(b.user.displayName))
      .slice(0, limit)
      .map(item => ({
        userId: item.user.userId,
        displayName: item.user.displayName,
        avatarUrl: isCloudinaryAvatarUrl(item.user.avatarUrl) ? item.user.avatarUrl : undefined,
      }))
  },
}

function sanitizeUser<T extends object>(user: T) {
  const raw = user as T & {
    passwordHash?: string
    resetToken?: string
    resetTokenExpiresAt?: string
  }
  const {
    passwordHash: _passwordHash,
    resetToken: _resetToken,
    resetTokenExpiresAt: _resetTokenExpiresAt,
    ...safe
  } = raw
  return safe
}
