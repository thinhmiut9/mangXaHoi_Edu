import { runQuery, runQueryOne } from '../../config/neo4j'
import { User, UserPublic } from '../../types'

export const usersRepository = {
  async findById(userId: string): Promise<User | null> {
    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {userId: $userId}) RETURN u`,
      { userId }
    )
    return result ? result.u.properties : null
  },

  // Keep the method name for route compatibility; lookup by displayName.
  async findByUsername(displayName: string): Promise<User | null> {
    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {displayName: $displayName}) RETURN u`,
      { displayName }
    )
    return result ? result.u.properties : null
  },

  async search(query: string, limit = 10, skip = 0): Promise<UserPublic[]> {
    const results = await runQuery<{ u: { properties: User } }>(
      `MATCH (u:User)
       WHERE u.status = 'ACTIVE' AND (
         toLower(coalesce(u.displayName, '')) CONTAINS toLower($query) OR
         toLower(coalesce(u.username, '')) CONTAINS toLower($query) OR
         toLower(coalesce(u.email, '')) CONTAINS toLower($query) OR
         toLower(coalesce(u.location, '')) CONTAINS toLower($query)
       )
       RETURN u
       ORDER BY u.displayName
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { query, limit, skip }
    )
    return results.map(r => sanitizeUser(r.u.properties))
  },

  async update(userId: string, data: Partial<Pick<User, 'displayName' | 'bio' | 'avatarUrl' | 'coverUrl' | 'location' | 'profileVisibility'>>): Promise<User | null> {
    const now = new Date().toISOString()
    const setClause = Object.keys(data)
      .map(key => `u.${key} = $${key}`)
      .join(', ')

    const result = await runQueryOne<{ u: { properties: User } }>(
      `MATCH (u:User {userId: $userId})
       SET ${setClause}, u.updatedAt = $now
       RETURN u`,
      { userId, ...data, now }
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
    const result = await runQueryOne<{ postsCount: number; friendsCount: number; groupsCount: number }>(
      `MATCH (u:User {userId: $userId})
       OPTIONAL MATCH (u)-[:CREATED]->(p:Post)
       OPTIONAL MATCH (u)-[fr]-(f:User)
       WHERE type(fr) IN ['FRIENDS_WITH', 'FRIEND_WITH']
       OPTIONAL MATCH (u)-[:MEMBER_OF]->(g:Group)
       RETURN count(DISTINCT p) AS postsCount,
               count(DISTINCT f) AS friendsCount,
               count(DISTINCT g) AS groupsCount`,
      { userId }
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
  return safe
}


