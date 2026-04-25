import { runQuery, runQueryOne } from '../../config/neo4j'
import { User, UserPublic, FriendStatus } from '../../types'

/** Normalize userId: replace spaces with hyphens to fix corrupted UUID data in Neo4j */
function normalizeUserId<T extends { userId?: string }>(user: T): T {
  if (user.userId) return { ...user, userId: user.userId.trim().replace(/\s+/g, '-') }
  return user
}

function normalizeUserIdParam(userId: string): string {
  return userId.trim().replace(/\s+/g, '-')
}

export const friendsRepository = {
  async isBlockedBetween(userId: string, targetId: string): Promise<boolean> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedTargetId = normalizeUserIdParam(targetId)
    const result = await runQueryOne<{ blocked: boolean }>(
      `MATCH (u:User), (t:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
         AND replace(trim(coalesce(t.userId, '')), ' ', '-') = $targetId
       RETURN EXISTS((u)-[:BLOCKED]->(t)) OR EXISTS((t)-[:BLOCKED]->(u)) AS blocked`,
      { userId: normalizedUserId, targetId: normalizedTargetId }
    )
    return !!result?.blocked
  },

  async getStatus(userId: string, targetId: string): Promise<{ status: FriendStatus | 'PENDING_RECEIVED' | null; direction: 'sent' | 'received' | null }> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedTargetId = normalizeUserIdParam(targetId)
    const result = await runQueryOne<{ status: string; direction: string }>(
      `MATCH (u:User), (t:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
         AND replace(trim(coalesce(t.userId, '')), ' ', '-') = $targetId
       OPTIONAL MATCH (u)-[r:REQUESTED]->(t)
       OPTIONAL MATCH (t)-[r2:REQUESTED]->(u)
       OPTIONAL MATCH (u)-[f]-(t)
       WHERE type(f) IN ['FRIENDS_WITH']
       RETURN
         CASE
            WHEN f IS NOT NULL THEN 'ACCEPTED'
           WHEN r IS NOT NULL THEN 'PENDING'
           WHEN r2 IS NOT NULL THEN 'PENDING_RECEIVED'
           ELSE NULL
         END AS status,
         CASE WHEN r IS NOT NULL THEN 'sent' WHEN r2 IS NOT NULL THEN 'received' ELSE NULL END AS direction`,
      { userId: normalizedUserId, targetId: normalizedTargetId }
    )
    if (!result?.status) return { status: null, direction: null }
    return {
      status: result.status as FriendStatus,
      direction: result.direction as 'sent' | 'received' | null,
    }
  },

  async sendRequest(userId: string, targetId: string): Promise<void> {
    const now = new Date().toISOString()
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedTargetId = normalizeUserIdParam(targetId)
    await runQuery(
      `MATCH (u:User), (t:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
         AND replace(trim(coalesce(t.userId, '')), ' ', '-') = $targetId
       MERGE (u)-[r:REQUESTED]->(t) SET r.createdAt = $now`,
      { userId: normalizedUserId, targetId: normalizedTargetId, now }
    )
  },

  async acceptRequest(userId: string, requesterId: string): Promise<void> {
    const now = new Date().toISOString()
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedRequesterId = normalizeUserIdParam(requesterId)
    await runQuery(
      `MATCH (requester:User)-[r:REQUESTED]->(u:User)
       WHERE replace(trim(coalesce(requester.userId, '')), ' ', '-') = $requesterId
         AND replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
       DELETE r
       MERGE (u)-[:FRIENDS_WITH {since: $now}]-(requester)`,
      { userId: normalizedUserId, requesterId: normalizedRequesterId, now }
    )
  },

  async rejectRequest(userId: string, requesterId: string): Promise<void> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedRequesterId = normalizeUserIdParam(requesterId)
    await runQuery(
      `MATCH (requester:User)-[r:REQUESTED]->(u:User)
       WHERE replace(trim(coalesce(requester.userId, '')), ' ', '-') = $requesterId
         AND replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
       DELETE r`,
      { userId: normalizedUserId, requesterId: normalizedRequesterId }
    )
  },

  async unfriend(userId: string, targetId: string): Promise<void> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedTargetId = normalizeUserIdParam(targetId)
    await runQuery(
      `MATCH (u:User)-[r]-(t:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
         AND replace(trim(coalesce(t.userId, '')), ' ', '-') = $targetId
         AND type(r) IN ['FRIENDS_WITH']
       DELETE r`,
      { userId: normalizedUserId, targetId: normalizedTargetId }
    )
  },

  async getFriends(userId: string, skip = 0, limit?: number): Promise<UserPublic[]> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const paginationClause = limit === undefined
      ? ''
      : 'SKIP toInteger($skip) LIMIT toInteger($limit)'
    const results = await runQuery<{ f: { properties: UserPublic } }>(
      `MATCH (u:User)-[r]-(f:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
         AND type(r) IN ['FRIENDS_WITH']
         AND coalesce(f.role, 'USER') <> 'ADMIN'
       WITH DISTINCT f
       RETURN f ORDER BY f.displayName ${paginationClause}`,
      { userId: normalizedUserId, skip, limit }
    )
    return results.map(r => normalizeUserId(r.f.properties))
  },

  async getPendingRequests(userId: string): Promise<UserPublic[]> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const results = await runQuery<{ u: { properties: UserPublic } }>(
      `MATCH (u:User)-[:REQUESTED]->(me:User)
       WHERE replace(trim(coalesce(me.userId, '')), ' ', '-') = $userId
         AND coalesce(u.role, 'USER') <> 'ADMIN'
       RETURN u ORDER BY u.displayName`,
      { userId: normalizedUserId }
    )
    return results.map(r => normalizeUserId(r.u.properties))
  },

  async getSentRequests(userId: string): Promise<UserPublic[]> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const results = await runQuery<{ u: { properties: UserPublic } }>(
      `MATCH (me:User)-[:REQUESTED]->(u:User)
       WHERE replace(trim(coalesce(me.userId, '')), ' ', '-') = $userId
         AND coalesce(u.role, 'USER') <> 'ADMIN'
       RETURN u ORDER BY u.displayName`,
      { userId: normalizedUserId }
    )
    return results.map(r => normalizeUserId(r.u.properties))
  },

  async cancelRequest(userId: string, targetId: string): Promise<void> {
    const normalizedUserId = normalizeUserIdParam(userId)
    const normalizedTargetId = normalizeUserIdParam(targetId)
    await runQuery(
      `MATCH (u:User)-[r:REQUESTED]->(t:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = $userId
         AND replace(trim(coalesce(t.userId, '')), ' ', '-') = $targetId
       DELETE r`,
      { userId: normalizedUserId, targetId: normalizedTargetId }
    )
  },

  async getSuggestions(userId: string, limit = 10): Promise<UserPublic[]> {
    const results = await runQuery<{ suggested: { properties: UserPublic }; mutualCount: number }>(
      `MATCH (me:User {userId: $userId})-[r1]-(friend:User)-[r2]-(suggested:User)
       WHERE type(r1) IN ['FRIENDS_WITH']
         AND type(r2) IN ['FRIENDS_WITH']
         AND suggested.userId <> $userId
         AND coalesce(suggested.role, 'USER') <> 'ADMIN'
         AND NOT EXISTS((me)-[:BLOCKED]->(suggested))
         AND NOT EXISTS((suggested)-[:BLOCKED]->(me))
         AND NOT EXISTS {
           MATCH (me)-[rf]-(suggested)
           WHERE type(rf) IN ['FRIENDS_WITH']
         }
         AND NOT (me)-[:REQUESTED]-(suggested)
         AND suggested.status = 'ACTIVE'
       RETURN suggested, count(friend) AS mutualCount
       ORDER BY mutualCount DESC LIMIT toInteger($limit)`,
      { userId, limit }
    )
    return results.map(r => ({ ...r.suggested.properties, mutualCount: r.mutualCount }))
  },

  async getSuggestionsFromIds(userId: string, recommendedIds: string[], limit = 10): Promise<UserPublic[]> {
    if (recommendedIds.length === 0) return []

    const results = await runQuery<{ idx: number; suggested: { properties: UserPublic } }>(
      `MATCH (me:User {userId: $userId})
       UNWIND range(0, size($recommendedIds) - 1) AS idx
       WITH me, idx, $recommendedIds[idx] AS recommendedId
       MATCH (suggested:User {userId: recommendedId})
       WHERE suggested.userId <> $userId
         AND coalesce(suggested.role, 'USER') <> 'ADMIN'
         AND suggested.status = 'ACTIVE'
         AND NOT EXISTS((me)-[:BLOCKED]->(suggested))
         AND NOT EXISTS((suggested)-[:BLOCKED]->(me))
         AND NOT EXISTS {
           MATCH (me)-[rf]-(suggested)
           WHERE type(rf) IN ['FRIENDS_WITH']
         }
         AND NOT (me)-[:REQUESTED]-(suggested)
       RETURN idx, suggested
       ORDER BY idx
       LIMIT toInteger($limit)`,
      { userId, recommendedIds, limit }
    )

    return results.map((r) => ({ ...r.suggested.properties, _recommendationIndex: r.idx } as UserPublic & { _recommendationIndex: number }))
  },

  async countFriends(userId: string): Promise<number> {
    const result = await runQueryOne<{ count: number }>(
      `MATCH (u:User {userId: $userId})-[r]-(f:User)
       WHERE type(r) IN ['FRIENDS_WITH']
         AND coalesce(f.role, 'USER') <> 'ADMIN'
       RETURN count(*) AS count`,
      { userId }
    )
    return result?.count ?? 0
  },

  async getFriendIds(userId: string): Promise<string[]> {
    const results = await runQuery<{ friendId: string }>(
      `MATCH (u:User {userId: $userId})-[r]-(f:User)
       WHERE type(r) IN ['FRIENDS_WITH']
         AND coalesce(f.role, 'USER') <> 'ADMIN'
       RETURN f.userId AS friendId`,
      { userId }
    )
    return results.map(r => r.friendId)
  },

  async blockUser(userId: string, targetId: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (u:User {userId: $userId}), (t:User {userId: $targetId})
       MERGE (u)-[b:BLOCKED]->(t)
       ON CREATE SET b.createdAt = $now
       WITH u, t
       OPTIONAL MATCH (u)-[f]-(t)
       WHERE type(f) IN ['FRIENDS_WITH', 'REQUESTED']
       DELETE f`,
      { userId, targetId, now }
    )
  },

  async unblockUser(userId: string, targetId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[b:BLOCKED]->(t:User {userId: $targetId})
       DELETE b`,
      { userId, targetId }
    )
  },

  async getBlockedUsers(userId: string): Promise<UserPublic[]> {
    const results = await runQuery<{ u: { properties: UserPublic } }>(
      `MATCH (:User {userId: $userId})-[:BLOCKED]->(u:User)
       RETURN u
       ORDER BY coalesce(u.displayName, '') ASC`,
      { userId }
    )
    return results.map(r => r.u.properties)
  },
}



