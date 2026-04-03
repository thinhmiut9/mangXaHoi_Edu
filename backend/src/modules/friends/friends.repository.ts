import { runQuery, runQueryOne } from '../../config/neo4j'
import { User, UserPublic, FriendStatus } from '../../types'

export const friendsRepository = {
  async getStatus(userId: string, targetId: string): Promise<{ status: FriendStatus | 'PENDING_RECEIVED' | null; direction: 'sent' | 'received' | null }> {
    const result = await runQueryOne<{ status: string; direction: string }>(
      `MATCH (u:User {userId: $userId})
       OPTIONAL MATCH (u)-[r:REQUESTED]->(t:User {userId: $targetId})
       OPTIONAL MATCH (t)-[r2:REQUESTED]->(u)
       OPTIONAL MATCH (u)-[f]-(t)
       WHERE type(f) IN ['FRIENDS_WITH', 'FRIEND_WITH']
       RETURN
         CASE
            WHEN f IS NOT NULL THEN 'ACCEPTED'
           WHEN r IS NOT NULL THEN 'PENDING'
           WHEN r2 IS NOT NULL THEN 'PENDING_RECEIVED'
           ELSE NULL
         END AS status,
         CASE WHEN r IS NOT NULL THEN 'sent' WHEN r2 IS NOT NULL THEN 'received' ELSE NULL END AS direction`,
      { userId, targetId }
    )
    if (!result?.status) return { status: null, direction: null }
    return {
      status: result.status as FriendStatus,
      direction: result.direction as 'sent' | 'received' | null,
    }
  },

  async sendRequest(userId: string, targetId: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (u:User {userId: $userId}), (t:User {userId: $targetId})
       MERGE (u)-[r:REQUESTED]->(t) SET r.createdAt = $now`,
      { userId, targetId, now }
    )
  },

  async acceptRequest(userId: string, requesterId: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (requester:User {userId: $requesterId})-[r:REQUESTED]->(u:User {userId: $userId})
       DELETE r
       MERGE (u)-[:FRIENDS_WITH {since: $now}]-(requester)`,
      { userId, requesterId, now }
    )
  },

  async rejectRequest(userId: string, requesterId: string): Promise<void> {
    await runQuery(
      `MATCH (requester:User {userId: $requesterId})-[r:REQUESTED]->(u:User {userId: $userId}) DELETE r`,
      { userId, requesterId }
    )
  },

  async unfriend(userId: string, targetId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[r]-(t:User {userId: $targetId})
       WHERE type(r) IN ['FRIENDS_WITH', 'FRIEND_WITH']
       DELETE r`,
      { userId, targetId }
    )
  },

  async getFriends(userId: string, skip = 0, limit = 20): Promise<UserPublic[]> {
    const results = await runQuery<{ f: { properties: UserPublic } }>(
      `MATCH (u:User {userId: $userId})-[r]-(f:User)
       WHERE type(r) IN ['FRIENDS_WITH', 'FRIEND_WITH']
         AND coalesce(f.role, 'USER') <> 'ADMIN'
       WITH DISTINCT f
       RETURN f ORDER BY f.displayName SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { userId, skip, limit }
    )
    return results.map(r => r.f.properties)
  },

  async getPendingRequests(userId: string): Promise<UserPublic[]> {
    const results = await runQuery<{ u: { properties: UserPublic } }>(
      `MATCH (u:User)-[:REQUESTED]->(me:User {userId: $userId})
       WHERE coalesce(u.role, 'USER') <> 'ADMIN'
       RETURN u ORDER BY u.displayName`,
      { userId }
    )
    return results.map(r => r.u.properties)
  },

  async getSentRequests(userId: string): Promise<UserPublic[]> {
    const results = await runQuery<{ u: { properties: UserPublic } }>(
      `MATCH (me:User {userId: $userId})-[:REQUESTED]->(u:User)
       WHERE coalesce(u.role, 'USER') <> 'ADMIN'
       RETURN u ORDER BY u.displayName`,
      { userId }
    )
    return results.map(r => r.u.properties)
  },

  async cancelRequest(userId: string, targetId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[r:REQUESTED]->(t:User {userId: $targetId})
       DELETE r`,
      { userId, targetId }
    )
  },

  async getSuggestions(userId: string, limit = 10): Promise<UserPublic[]> {
    const results = await runQuery<{ suggested: { properties: UserPublic }; mutualCount: number }>(
      `MATCH (me:User {userId: $userId})-[r1]-(friend:User)-[r2]-(suggested:User)
       WHERE type(r1) IN ['FRIENDS_WITH', 'FRIEND_WITH']
         AND type(r2) IN ['FRIENDS_WITH', 'FRIEND_WITH']
         AND suggested.userId <> $userId
         AND coalesce(suggested.role, 'USER') <> 'ADMIN'
         AND NOT EXISTS {
           MATCH (me)-[rf]-(suggested)
           WHERE type(rf) IN ['FRIENDS_WITH', 'FRIEND_WITH']
         }
         AND NOT (me)-[:REQUESTED]-(suggested)
         AND suggested.status = 'ACTIVE'
       RETURN suggested, count(friend) AS mutualCount
       ORDER BY mutualCount DESC LIMIT toInteger($limit)`,
      { userId, limit }
    )
    return results.map(r => ({ ...r.suggested.properties, mutualCount: r.mutualCount }))
  },

  async countFriends(userId: string): Promise<number> {
    const result = await runQueryOne<{ count: number }>(
      `MATCH (u:User {userId: $userId})-[r]-(f:User)
       WHERE type(r) IN ['FRIENDS_WITH', 'FRIEND_WITH']
         AND coalesce(f.role, 'USER') <> 'ADMIN'
       RETURN count(*) AS count`,
      { userId }
    )
    return result?.count ?? 0
  },

  async getFriendIds(userId: string): Promise<string[]> {
    const results = await runQuery<{ friendId: string }>(
      `MATCH (u:User {userId: $userId})-[r]-(f:User)
       WHERE type(r) IN ['FRIENDS_WITH', 'FRIEND_WITH']
         AND coalesce(f.role, 'USER') <> 'ADMIN'
       RETURN f.userId AS friendId`,
      { userId }
    )
    return results.map(r => r.friendId)
  },
}


