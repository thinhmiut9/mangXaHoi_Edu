import { runQueryOne } from '../../config/neo4j'
import { usersRepository } from '../users/users.repository'
import { AppError } from '../../middleware/errorHandler'

function toNumberSafe(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const maybeNeo4jInt = value as { toNumber?: () => number }
    const parsed = maybeNeo4jInt.toNumber?.()
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export const adminService = {
  async getDashboard() {
    const stats = await runQueryOne<{
      totalUsers: number
      totalPosts: number
      totalGroups: number
      totalReports: number
      openReports: number
      newUsersToday: number
      blockedUsers: number
      totalInteractions: number
    }>(
      `MATCH (u:User)
       WITH count(u) AS totalUsers,
            count(CASE WHEN coalesce(u.status, 'ACTIVE') = 'BLOCKED' THEN 1 END) AS blockedUsers,
            count(CASE WHEN coalesce(u.createdAt, '') >= $todayStart THEN 1 END) AS newUsersToday
       MATCH (p:Post)
       WITH totalUsers, blockedUsers, newUsersToday, count(p) AS totalPosts,
            sum(coalesce(p.likesCount, 0) + coalesce(p.commentsCount, 0) + coalesce(p.sharesCount, 0)) AS totalInteractions
       MATCH (g:Group)
       WITH totalUsers, blockedUsers, newUsersToday, totalPosts, totalInteractions, count(g) AS totalGroups
       MATCH (r:Report)
       WITH totalUsers, blockedUsers, newUsersToday, totalPosts, totalInteractions, totalGroups,
            count(r) AS totalReports,
            count(CASE WHEN coalesce(r.status, 'OPEN') = 'OPEN' THEN 1 END) AS openReports
       RETURN totalUsers, totalPosts, totalGroups, totalReports, openReports, newUsersToday, blockedUsers, totalInteractions`,
      { todayStart: new Date().toISOString().slice(0, 10) }
    )

    return {
      totalUsers: toNumberSafe(stats?.totalUsers),
      totalPosts: toNumberSafe(stats?.totalPosts),
      totalGroups: toNumberSafe(stats?.totalGroups),
      totalReports: toNumberSafe(stats?.totalReports),
      openReports: toNumberSafe(stats?.openReports),
      newUsersToday: toNumberSafe(stats?.newUsersToday),
      blockedUsers: toNumberSafe(stats?.blockedUsers),
      totalInteractions: toNumberSafe(stats?.totalInteractions),
    }
  },

  async listUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit
    const [users, total] = await Promise.all([
      usersRepository.listAll(skip, limit, search),
      usersRepository.countAll(),
    ])
    const safeUsers = users.map((u) => {
      const { passwordHash: _passwordHash, ...safe } = u
      return safe
    })
    return { users: safeUsers, total }
  },

  async getUserDetail(userId: string) {
    const user = await usersRepository.findById(userId)
    if (!user) throw new AppError('Người dùng không tồn tại', 404, 'USER_NOT_FOUND')
    const stats = await usersRepository.getStats(userId)
    const { passwordHash: _passwordHash, ...safeUser } = user
    return {
      ...safeUser,
      postsCount: toNumberSafe(stats.postsCount),
      friendsCount: toNumberSafe(stats.friendsCount),
      groupsCount: toNumberSafe(stats.groupsCount),
    }
  },

  async blockUser(userId: string, actorId?: string) {
    const user = await usersRepository.findById(userId)
    if (!user) throw new AppError('Người dùng không tồn tại', 404, 'USER_NOT_FOUND')
    if (user.role === 'ADMIN') throw new AppError('Không thể khóa tài khoản ADMIN', 403, 'CANNOT_BLOCK_ADMIN')
    if (actorId && user.userId === actorId) throw new AppError('Không thể tự khóa chính bạn', 400, 'CANNOT_BLOCK_SELF')
    await usersRepository.updateStatus(userId, 'BLOCKED')
  },

  async unblockUser(userId: string) {
    const user = await usersRepository.findById(userId)
    if (!user) throw new AppError('Người dùng không tồn tại', 404, 'USER_NOT_FOUND')
    await usersRepository.updateStatus(userId, 'ACTIVE')
  },
}
