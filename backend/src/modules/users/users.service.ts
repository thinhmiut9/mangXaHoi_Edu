import { usersRepository } from './users.repository'
import { AppError } from '../../middleware/errorHandler'
import { UpdateProfileDto } from './users.schema'
import { paginationMeta } from '../../utils/response'
import { UserPublic } from '../../types'
import { friendsRepository } from '../friends/friends.repository'
import { postsRepository } from '../posts/posts.repository'
import { groupsRepository } from '../groups/groups.repository'
import { filterCloudinaryImageUrls } from '../../utils/cloudinary'

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

  let best = 0
  for (const field of fields) {
    if (field === keywordNorm) best = Math.max(best, 100)
    else if (field.startsWith(keywordNorm)) best = Math.max(best, 90)
    else if (field.includes(keywordNorm)) best = Math.max(best, 80)

    const words = field.split(/\s+/).filter(Boolean)
    for (const word of words) {
      if (word.startsWith(keywordNorm) || keywordNorm.startsWith(word)) {
        best = Math.max(best, 75)
      }
      const maxLen = Math.max(word.length, keywordNorm.length)
      if (maxLen >= 3) {
        const similarity = 1 - levenshtein(word, keywordNorm) / maxLen
        if (similarity >= 0.7) best = Math.max(best, Math.round(similarity * 70))
      }
    }
  }
  return best
}

export const usersService = {
  async getProfile(userId: string, viewerId?: string) {
    const user = await usersRepository.findById(userId)
    if (!user || user.status === 'BLOCKED') {
      throw new AppError('Người dùng không tồn tại', 404, 'USER_NOT_FOUND')
    }
    const stats = await usersRepository.getStats(userId)
    const isOwnProfile = viewerId === userId
    return { ...sanitizeUser(user), ...stats, isOwnProfile }
  },

  async getProfileByUsername(username: string, viewerId?: string) {
    const user = await usersRepository.findByUsername(username)
    if (!user || user.status === 'BLOCKED') {
      throw new AppError('Người dùng không tồn tại', 404, 'USER_NOT_FOUND')
    }
    const stats = await usersRepository.getStats(user.userId)
    const isOwnProfile = viewerId === user.userId
    return { ...sanitizeUser(user), ...stats, isOwnProfile }
  },

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await usersRepository.update(userId, dto)
    if (!updated) throw new AppError('Cập nhật thất bại', 500)
    return sanitizeUser(updated)
  },

  async getUserFriends(userId: string, viewerId?: string) {
    const user = await usersRepository.findById(userId)
    if (!user || user.status === 'BLOCKED') {
      throw new AppError('Người dùng không tồn tại', 404, 'USER_NOT_FOUND')
    }
    void viewerId
    return friendsRepository.getFriends(userId, 0, 300)
  },

  async searchUsers(q: string, page: number, limit: number) {
    const keyword = q.trim()
    if (!keyword) return { users: [], meta: paginationMeta(page, limit, 0) }

    const keywordNorm = normalizeForSearch(keyword)
    const candidates = await usersRepository.search('', 500, 0)

    const ranked = candidates
      .map(user => ({ user, score: scoreUser(user, keywordNorm) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.user.displayName.localeCompare(b.user.displayName))

    const skip = (page - 1) * limit
    const users = ranked.slice(skip, skip + limit).map(item => item.user)
    return { users, meta: paginationMeta(page, limit, ranked.length) }
  },

  async searchAll(viewerId: string, q: string, limit: number) {
    const keyword = q.trim()
    if (!keyword) return { users: [], posts: [], groups: [] }

    const userSearch = usersService.searchUsers(keyword, 1, limit)
    const postSearch = postsRepository.searchVisiblePosts(viewerId, keyword, limit)
    const groupSearch = groupsRepository.searchVisibleGroups(viewerId, keyword, limit)

    const [usersResult, posts, groups] = await Promise.all([userSearch, postSearch, groupSearch])

    return {
      users: usersResult.users,
      posts: posts.map((post) => ({
        ...post,
        mediaUrls: filterCloudinaryImageUrls(post.mediaUrls),
      })),
      groups,
    }
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
