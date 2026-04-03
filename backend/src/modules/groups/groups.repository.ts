import { runQuery, runQueryOne } from '../../config/neo4j'
import { Group, UserPublic } from '../../types'

export const groupsRepository = {
  async create(data: { groupId: string; name: string; description?: string; coverUrl?: string; privacy: string; ownerId: string }): Promise<Group> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ g: { properties: Group } }>(
      `MATCH (u:User {userId: $ownerId})
       CREATE (g:Group {
         groupId: $groupId, name: $name, description: $description, coverUrl: $coverUrl,
         ownerId: $ownerId,
         privacy: $privacy, status: 'ACTIVE',
         createdAt: $now, updatedAt: $now
       })
       MERGE (u)-[:OWNER_OF]->(g)
       MERGE (u)-[:MEMBER_OF {role: 'OWNER', joinedAt: $now}]->(g)
       RETURN g`,
      { ...data, description: data.description ?? '', coverUrl: data.coverUrl ?? '', now }
    )
    return result!.g.properties
  },

  async findById(groupId: string, viewerId?: string): Promise<Group | null> {
    const result = await runQueryOne<{
      g: { properties: Group }
      owner: { properties: Record<string, unknown> }
      isMember: boolean
      isOwner: boolean
      membersCount: number
    }>(
      `MATCH (g:Group {groupId: $groupId})
       OPTIONAL MATCH (ownerRel:User)-[:OWNER_OF]->(g)
       OPTIONAL MATCH (ownerProp:User {userId: g.ownerId})
       OPTIONAL MATCH (ownerByRole:User)-[:MEMBER_OF {role: 'OWNER'}]->(g)
       OPTIONAL MATCH (viewer:User {userId: $viewerId})
       OPTIONAL MATCH (viewer)-[viewerRole:MEMBER_OF]->(g)
       WITH g, coalesce(ownerRel, ownerProp, ownerByRole) AS owner, viewer, viewerRole
       RETURN g, owner,
              EXISTS((viewer)-[:MEMBER_OF]->(g)) AS isMember,
              (EXISTS((viewer)-[:OWNER_OF]->(g)) OR g.ownerId = $viewerId OR viewerRole.role = 'OWNER') AS isOwner,
              COUNT { ()-[:MEMBER_OF]->(g) } AS membersCount`,
      { groupId, viewerId: viewerId ?? '' }
    )
    if (!result) return null
    return {
      ...result.g.properties,
      owner: result.owner?.properties as unknown as UserPublic,
      isMember: result.isMember,
      isOwner: result.isOwner,
      membersCount: result.membersCount,
    }
  },

  async list(viewerId: string, skip = 0, limit = 20): Promise<Group[]> {
    const results = await runQuery<{
      g: { properties: Group }
      isMember: boolean
      isJoinRequested: boolean
      membersCount: number
    }>(
      `MATCH (g:Group) WHERE g.status = 'ACTIVE'
       OPTIONAL MATCH (viewer:User {userId: $viewerId})
       RETURN g,
              EXISTS((viewer)-[:MEMBER_OF]->(g)) AS isMember,
              EXISTS((viewer)-[:JOIN_REQUESTED]->(g)) AS isJoinRequested,
              COUNT { ()-[:MEMBER_OF]->(g) } AS membersCount
       ORDER BY membersCount DESC SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { viewerId, skip, limit }
    )
    return results.map(r => ({
      ...r.g.properties,
      isMember: r.isMember,
      isJoinRequested: r.isJoinRequested,
      membersCount: r.membersCount
    }))
  },

  async getMyGroups(userId: string): Promise<Group[]> {
    const results = await runQuery<{
      g: { properties: Group }
      membersCount: number
      isOwner: boolean
    }>(
      `MATCH (u:User {userId: $userId})-[:MEMBER_OF]->(g:Group)
       OPTIONAL MATCH (u)-[ownerMembership:MEMBER_OF]->(g)
       RETURN g,
              COUNT { ()-[:MEMBER_OF]->(g) } AS membersCount,
              (EXISTS((u)-[:OWNER_OF]->(g)) OR g.ownerId = $userId OR ownerMembership.role = 'OWNER') AS isOwner
       ORDER BY g.name`,
      { userId }
    )
    return results.map(r => ({
      ...r.g.properties,
      isMember: true,
      isOwner: r.isOwner,
      membersCount: r.membersCount,
    }))
  },

  async join(groupId: string, userId: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (u:User {userId: $userId}), (g:Group {groupId: $groupId})
       OPTIONAL MATCH (u)-[req:JOIN_REQUESTED]->(g)
       DELETE req
       MERGE (u)-[:MEMBER_OF {role: 'MEMBER', joinedAt: $now}]->(g)`,
      { userId, groupId, now }
    )
  },

  async requestJoin(groupId: string, userId: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (u:User {userId: $userId}), (g:Group {groupId: $groupId})
       MERGE (u)-[:JOIN_REQUESTED {requestedAt: $now}]->(g)`,
      { userId, groupId, now }
    )
  },

  async getOwnerId(groupId: string): Promise<string | null> {
    const result = await runQueryOne<{ ownerId: string }>(
      `MATCH (g:Group {groupId: $groupId})
       OPTIONAL MATCH (owner:User)-[:OWNER_OF]->(g)
       OPTIONAL MATCH (ownerByRole:User)-[:MEMBER_OF {role: 'OWNER'}]->(g)
       RETURN coalesce(owner.userId, g.ownerId, ownerByRole.userId) AS ownerId`,
      { groupId }
    )
    return result?.ownerId ?? null
  },

  async getJoinRequests(groupId: string, skip = 0, limit = 20) {
    return runQuery<{
      requester: { properties: Record<string, unknown> }
      requestedAt: string
    }>(
      `MATCH (requester:User)-[r:JOIN_REQUESTED]->(g:Group {groupId: $groupId})
       RETURN requester, r.requestedAt AS requestedAt
       ORDER BY r.requestedAt DESC
       SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { groupId, skip, limit }
    )
  },

  async approveJoinRequest(groupId: string, requesterId: string): Promise<void> {
    const now = new Date().toISOString()
    await runQuery(
      `MATCH (u:User {userId: $requesterId})-[r:JOIN_REQUESTED]->(g:Group {groupId: $groupId})
       DELETE r
       MERGE (u)-[:MEMBER_OF {role: 'MEMBER', joinedAt: $now}]->(g)`,
      { groupId, requesterId, now }
    )
  },

  async rejectJoinRequest(groupId: string, requesterId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $requesterId})-[r:JOIN_REQUESTED]->(g:Group {groupId: $groupId})
       DELETE r`,
      { groupId, requesterId }
    )
  },

  async leave(groupId: string, userId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[r:MEMBER_OF]->(g:Group {groupId: $groupId}) DELETE r`,
      { userId, groupId }
    )
  },

  async update(groupId: string, data: Partial<{ name: string; description: string; coverUrl: string; privacy: string; status: string }>): Promise<Group | null> {
    const now = new Date().toISOString()
    const setClauses = Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => `g.${k} = $${k}`).join(', ')
    const result = await runQueryOne<{ g: { properties: Group } }>(
      `MATCH (g:Group {groupId: $groupId}) SET ${setClauses}, g.updatedAt = $now RETURN g`,
      { groupId, ...data, now }
    )
    return result ? result.g.properties : null
  },

  async getMembers(groupId: string, skip = 0, limit = 20) {
    return runQuery(
      `MATCH (u:User)-[r:MEMBER_OF]->(g:Group {groupId: $groupId})
       RETURN u, r.role AS role ORDER BY r.joinedAt SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { groupId, skip, limit }
    )
  },

  async isMember(groupId: string, userId: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (u:User {userId: $userId})-[:MEMBER_OF]->(g:Group {groupId: $groupId}) RETURN true AS exists`,
      { groupId, userId }
    )
    return !!result?.exists
  },

  async isOwner(groupId: string, userId: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (g:Group {groupId: $groupId})
       OPTIONAL MATCH (u:User {userId: $userId})-[:OWNER_OF]->(g)
       OPTIONAL MATCH (m:User {userId: $userId})-[r:MEMBER_OF]->(g)
       RETURN (u IS NOT NULL OR g.ownerId = $userId OR (m IS NOT NULL AND r.role = 'OWNER')) AS exists`,
      { groupId, userId }
    )
    return !!result?.exists
  },

  async isJoinRequested(groupId: string, userId: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (u:User {userId: $userId})-[:JOIN_REQUESTED]->(g:Group {groupId: $groupId}) RETURN true AS exists`,
      { groupId, userId }
    )
    return !!result?.exists
  },

  async countTotal(): Promise<number> {
    const result = await runQueryOne<{ count: number }>(
      `MATCH (g:Group) RETURN count(g) AS count`, {}
    )
    return result?.count ?? 0
  },

  async searchVisibleGroups(viewerId: string, keyword: string, limit = 12): Promise<Group[]> {
    const results = await runQuery<{
      g: { properties: Group }
      isMember: boolean
      isOwner: boolean
      membersCount: number
      isJoinRequested: boolean
    }>(
      `MATCH (viewer:User {userId: $viewerId})
       MATCH (g:Group)
       WHERE g.status = 'ACTIVE'
         AND (
           toLower(coalesce(g.name, '')) CONTAINS toLower($keyword)
           OR toLower(coalesce(g.description, '')) CONTAINS toLower($keyword)
         )
         AND (
           g.privacy = 'PUBLIC'
           OR EXISTS((viewer)-[:MEMBER_OF]->(g))
         )
       OPTIONAL MATCH (viewer)-[viewerRole:MEMBER_OF]->(g)
       RETURN g,
              EXISTS((viewer)-[:MEMBER_OF]->(g)) AS isMember,
              (EXISTS((viewer)-[:OWNER_OF]->(g)) OR g.ownerId = $viewerId OR viewerRole.role = 'OWNER') AS isOwner,
              EXISTS((viewer)-[:JOIN_REQUESTED]->(g)) AS isJoinRequested,
              COUNT { ()-[:MEMBER_OF]->(g) } AS membersCount
       ORDER BY membersCount DESC, g.updatedAt DESC
       LIMIT toInteger($limit)`,
      { viewerId, keyword, limit }
    )

    return results.map(r => ({
      ...r.g.properties,
      isMember: r.isMember,
      isOwner: r.isOwner,
      isJoinRequested: r.isJoinRequested,
      membersCount: r.membersCount,
    }))
  },
}


