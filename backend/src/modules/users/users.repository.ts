import { runQuery, runQueryOne } from '../../config/neo4j'
import { User, UserPublic } from '../../types'

function normalizeUserIdParam(userId: string): string {
  return userId.trim().replace(/\s+/g, '-')
}

export const usersRepository = {
  async findById(userId: string): Promise<User | null> {
    const normalizedId = normalizeUserIdParam(userId)
    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $normalizedId
       RETURN u LIMIT 1`,
      { normalizedId }
    )
    if (!result) return null
    const user = result.u.properties
    // Always return normalized userId
    if (user.userId) user.userId = user.userId.trim().replace(/\s+/g, '-')
    return user
  },

  // Keep the method name for route compatibility; lookup by displayName.
  async findByUsername(displayName: string): Promise<User | null> {
    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {displayName: $displayName}) RETURN u`,
      { displayName }
    )
    if (!result) return null
    const user = result.u.properties
    if (user.userId) user.userId = normalizeUserIdParam(user.userId)
    return user
  },

  async search(query: string, limit = 10, skip = 0, viewerId?: string): Promise<UserPublic[]> {
    const q = query.trim()
    const results = await runQuery<{ u: { properties: User } }>(
      `MATCH (u:User)
       OPTIONAL MATCH (viewer:User {userId: $viewerId})
       WHERE u.status = 'ACTIVE' AND (
         toLower(coalesce(u.displayName, '')) CONTAINS toLower($q) OR
         toLower(coalesce(u.username, ''))    CONTAINS toLower($q) OR
         toLower(coalesce(u.email, ''))       CONTAINS toLower($q) OR
         toLower(coalesce(u.location, ''))    CONTAINS toLower($q)
       )
       AND ($viewerId = '' OR u.userId <> $viewerId)
       AND (
         $viewerId = ''
         OR viewer IS NULL
         OR (NOT EXISTS((viewer)-[:BLOCKED]->(u)) AND NOT EXISTS((u)-[:BLOCKED]->(viewer)))
       )
       RETURN u
       ORDER BY u.displayName
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { q, limit, skip, viewerId: viewerId ?? '' }
    )
    return results.map(r => sanitizeUser(r.u.properties))
  },

  async update(userId: string, data: Partial<Pick<User, 'displayName' | 'interests' | 'avatarUrl' | 'coverUrl' | 'location' | 'school' | 'major' | 'cohort' | 'profileVisibility'>> & { avatarUrl?: string | null; coverUrl?: string | null }): Promise<User | null> {
    const now = new Date().toISOString()
    // Filter out undefined values but keep null (null = remove property in Neo4j)
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    )
    if (Object.keys(filteredData).length === 0) {
      return this.findById(userId)
    }
    const setClause = Object.keys(filteredData)
      .map(key => `u.${key} = $${key}`)
      .join(', ')

    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {userId: $userId})
       SET ${setClause}, u.updatedAt = $now
       RETURN u`,
      { userId, ...filteredData, now }
    )
    return result ? result.u.properties : null
  },

  async updateStatus(userId: string, status: 'ACTIVE' | 'BLOCKED'): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})
       SET u.status = $status,
           u.blockedUntil = CASE WHEN $status = 'BLOCKED' THEN u.blockedUntil ELSE null END,
           u.updatedAt = $now`,
      { userId, status, now: new Date().toISOString() }
    )
  },

  async blockForDuration(userId: string, hours: number): Promise<string> {
    const now = Date.now()
    const blockedUntil = new Date(now + hours * 60 * 60 * 1000).toISOString()
    await runQuery(
      `MATCH (u:User {userId: $userId})
       SET u.status = 'BLOCKED',
           u.blockedUntil = $blockedUntil,
           u.updatedAt = $nowIso`,
      { userId, blockedUntil, nowIso: new Date(now).toISOString() }
    )
    return blockedUntil
  },

  async getStats(userId: string): Promise<{ postsCount: number; friendsCount: number; groupsCount: number }> {
    const normalizedId = normalizeUserIdParam(userId)
    const result = await runQueryOne<{ postsCount: number; friendsCount: number; groupsCount: number }>(
      `MATCH (u:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $normalizedId
       RETURN COUNT {
                (u)-[:CREATED]->(p:Post)
                WHERE (p.groupId IS NULL OR p.groupId = '' OR p.groupId = 'null')
                  AND coalesce(p.visibility, p.privacy, 'PUBLIC') <> 'GROUP'
              } AS postsCount,
              COUNT {
                (u)-[fr]-(f:User)
                WHERE type(fr) IN ['FRIENDS_WITH']
                  AND coalesce(f.role, 'USER') <> 'ADMIN'
              } AS friendsCount,
              COUNT { (u)-[:MEMBER_OF]->(:Group) } AS groupsCount`,
      { normalizedId }
    )
    return result ?? { postsCount: 0, friendsCount: 0, groupsCount: 0 }
  },

  async countAll(): Promise<number> {
    const result = await runQueryOne<{ count: number }>(
      `MATCH (u:User) RETURN count(u) AS count`
    )
    return result?.count ?? 0
  },

  async listAll(skip = 0, limit = 20, search?: string): Promise<User[]> {
    const whereClause = search
      ? `WHERE u.displayName CONTAINS $search OR u.email CONTAINS $search OR coalesce(u.location, '') CONTAINS $search`
      : ''
    const results = await runQuery<{ u: User }>(
      `MATCH (u:User) ${whereClause}
       RETURN u {
         .*,
         createdAt: coalesce(toString(u.createdAt), toString(u.updatedAt), toString(u.lastOnlineAt), '')
       } AS u
       ORDER BY coalesce(toString(u.createdAt), toString(u.updatedAt), '') DESC
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { skip, limit, search: search ?? '' }
    )
    return results.map(r => r.u)
  },
}

function sanitizeUser(user: User): UserPublic {
  const { passwordHash: _passwordHash, updatedAt: _updatedAt, ...safe } = user
  // Normalize userId: replace spaces with hyphens (handles corrupted UUID data)
  if (safe.userId) safe.userId = safe.userId.trim().replace(/\s+/g, '-')
  return safe
}




