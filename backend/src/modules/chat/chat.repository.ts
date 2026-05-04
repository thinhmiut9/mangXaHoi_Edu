import { runQuery, runQueryOne } from '../../config/neo4j'
import { Conversation, Message, UserPublic } from '../../types'
import { v4 as uuidv4 } from 'uuid'

export const chatRepository = {
  async existsByRef(conversationRef: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       RETURN true AS exists
       LIMIT 1`,
      { conversationRef }
    )
    return !!result?.exists
  },

  async getConversations(userId: string): Promise<Conversation[]> {
    const results = await runQuery<{
      c: { properties: Conversation }
      lastMessage: any
      unread: number
      participants: Array<Record<string, unknown>>
    }>(
      `MATCH (u:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation)
       OPTIONAL MATCH (c)-[:PARTICIPATES_IN]-(other:User)
       WHERE c.type = 'GROUP' OR other.userId <> $userId
       WITH u, c, collect(other {
         .userId, .email, .displayName, .avatarUrl, .coverUrl, .location,
         .role, .status, .profileVisibility, .createdAt, .lastOnlineAt
       }) AS participants
       OPTIONAL MATCH (lm:Message)-[:IN_CONVERSATION]->(c)
       WITH u, c, participants, lm ORDER BY lm.createdAt DESC
       WITH u, c, participants, head(collect(lm)) AS lastMessageNode
       OPTIONAL MATCH (lastMessageNode)<-[:SENT]-(lmSender:User)
       WITH u, c, participants, CASE WHEN lastMessageNode IS NOT NULL THEN lastMessageNode { .*, senderId: lmSender.userId } ELSE null END AS lastMessage
       OPTIONAL MATCH (u)-[hidden:HIDDEN_CONVERSATION]->(c)
       WITH u, c, participants, lastMessage, coalesce(hidden.hiddenAt, hidden.at, '') AS hiddenAt
       WHERE hiddenAt = '' OR (c.lastMessageAt IS NOT NULL AND c.lastMessageAt > hiddenAt)
       OPTIONAL MATCH (u)-[read:READ]->(c)
       WITH u, c, participants, lastMessage, hiddenAt, coalesce(read.at, '') AS readAt
       WITH u, c, participants, lastMessage,
            CASE WHEN readAt > hiddenAt THEN readAt ELSE hiddenAt END AS baseline
       OPTIONAL MATCH (um:Message)-[:IN_CONVERSATION]->(c)<-[:SENT]-(sender:User)
       WHERE (baseline = '' OR um.createdAt > baseline) AND sender.userId <> $userId
       RETURN c, participants, lastMessage, count(um) AS unread
       ORDER BY c.lastMessageAt DESC`,
      { userId }
    )
    return results.map(r => ({
      ...r.c.properties,
      participants: (r.participants ?? []) as unknown as UserPublic[],
      unreadCount: r.unread,
      lastMessage: r.lastMessage,
    }))
  },

  async findOrCreateDirect(userId: string, targetId: string): Promise<Conversation> {
    const now = new Date().toISOString()
    const directKey = [userId, targetId].sort().join(':')

    const existing = await runQueryOne<{ c: { properties: Conversation } }>(
      `MATCH (u:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation {type: 'DIRECT'})-[:PARTICIPATES_IN]-(t:User {userId: $targetId})
       RETURN c
       ORDER BY c.lastMessageAt DESC, c.updatedAt DESC, c.createdAt DESC
       LIMIT 1`,
      { userId, targetId }
    )

    // Check if they are friends to set requestStatus
    const areFriends = await chatRepository.areFriends(userId, targetId)
    const requestStatus = areFriends ? 'ACCEPTED' : 'PENDING'

    if (existing?.c?.properties?.conversationId) {
      await runQuery(
        `MATCH (u:User {userId: $userId}), (t:User {userId: $targetId}), (c:Conversation {conversationId: $conversationId})
         SET c.directKey = coalesce(c.directKey, $directKey),
             c.updatedAt = coalesce(c.updatedAt, $now),
             c.lastMessageAt = coalesce(c.lastMessageAt, $now),
             c.requestStatus = CASE WHEN $areFriends THEN 'ACCEPTED' ELSE coalesce(c.requestStatus, 'PENDING') END,
             c.requesterId = coalesce(c.requesterId, $userId)
         MERGE (u)-[:PARTICIPATES_IN]->(c)
         MERGE (t)-[:PARTICIPATES_IN]->(c)`,
        {
          userId,
          targetId,
          conversationId: existing.c.properties.conversationId,
          directKey,
          now,
          areFriends,
        }
      )
      return { ...existing.c.properties, requestStatus: areFriends ? 'ACCEPTED' : (existing.c.properties as any).requestStatus ?? 'PENDING' }
    }

    const created = await runQueryOne<{ c: { properties: Conversation } }>(
      `MATCH (u:User {userId: $userId}), (t:User {userId: $targetId})
       MERGE (c:Conversation {type: 'DIRECT', directKey: $directKey})
       ON CREATE SET c.conversationId = $newId, c.createdAt = $now, c.updatedAt = $now,
                     c.lastMessageAt = $now, c.requestStatus = $requestStatus, c.requesterId = $userId
       MERGE (u)-[:PARTICIPATES_IN]->(c)
       MERGE (t)-[:PARTICIPATES_IN]->(c)
       RETURN c`,
      { userId, targetId, directKey, newId: uuidv4(), now, requestStatus }
    )

    return created!.c.properties
  },

  async getMessages(conversationRef: string, userId: string, skip = 0, limit = 50): Promise<Message[]> {
    const results = await runQuery<{ m: { properties: Message }; sender: Record<string, unknown> }>(
      `MATCH (me:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       OPTIONAL MATCH (me)-[hidden:HIDDEN_CONVERSATION]->(c)
       WITH c, coalesce(hidden.hiddenAt, hidden.at, '') AS hiddenAt
       MATCH (c)<-[:IN_CONVERSATION]-(m:Message)<-[:SENT]-(u:User)
       WHERE hiddenAt = '' OR m.createdAt > hiddenAt
       RETURN m, u {
         .userId, .email, .displayName, .avatarUrl, .coverUrl, .location,
         .role, .status, .profileVisibility, .createdAt, .lastOnlineAt
       } AS sender
       ORDER BY m.createdAt DESC SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { conversationRef, userId, skip, limit }
    )
    return results.map(r => ({
      ...r.m.properties,
      sender: r.sender as unknown as UserPublic,
    })).reverse()
  },

  async getMediaMessages(conversationRef: string, userId: string): Promise<Message[]> {
    const results = await runQuery<{ m: { properties: Message }; sender: Record<string, unknown> }>(
      `MATCH (me:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       OPTIONAL MATCH (me)-[hidden:HIDDEN_CONVERSATION]->(c)
       WITH c, coalesce(hidden.hiddenAt, hidden.at, '') AS hiddenAt
       MATCH (c)<-[:IN_CONVERSATION]-(m:Message)<-[:SENT]-(u:User)
       WHERE m.type IN ['IMAGE', 'VIDEO', 'FILE', 'LINK']
         AND (hiddenAt = '' OR m.createdAt > hiddenAt)
       RETURN m, u { .userId, .displayName, .avatarUrl } AS sender
       ORDER BY m.createdAt DESC
       LIMIT 100`,
      { conversationRef, userId }
    )
    return results.map(r => ({
      ...r.m.properties,
      sender: r.sender as unknown as UserPublic,
    }))
  },

  async createMessage(data: {
    messageId: string
    conversationId: string
    senderId: string
    content: string
    type?: string
    mediaUrl?: string
    fileName?: string
    fileSize?: number
    mimeType?: string
    thumbnailUrl?: string
  }): Promise<Message> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ m: { properties: Message } }>(
      `MATCH (u:User {userId: $senderId}), (c:Conversation)
       WHERE c.conversationId = $conversationId OR c.directKey = $conversationId
       MERGE (u)-[:PARTICIPATES_IN]-(c)
       CREATE (m:Message {
         messageId: $messageId,
         conversationId: $conversationId,
         content: $content,
         type: $type,
         mediaUrl: $mediaUrl,
         fileName: $fileName,
         fileSize: $fileSize,
         mimeType: $mimeType,
         thumbnailUrl: $thumbnailUrl,
         createdAt: $now
       })<-[:SENT {createdAt: $now}]-(u)
       CREATE (m)-[:IN_CONVERSATION]->(c)
       SET c.updatedAt = $now, c.lastMessageAt = $now
       RETURN m`,
      {
        ...data,
        type: data.type ?? 'TEXT',
        mediaUrl: data.mediaUrl ?? null,
        fileName: data.fileName ?? null,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        now
      }
    )
    return result!.m.properties
  },

  async markAsRead(conversationRef: string, userId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       MERGE (u)-[r:READ]->(c)
       SET r.at = $at`,
      { conversationRef, userId, at: new Date().toISOString() }
    )
  },

  async isParticipant(conversationRef: string, userId: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (u:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       RETURN true AS exists`,
      { conversationRef, userId }
    )
    return !!result?.exists
  },

  async areFriends(userId: string, targetId: string): Promise<boolean> {
    const result = await runQueryOne<{ exists: boolean }>(
      `MATCH (u:User {userId: $userId})-[r]-(t:User {userId: $targetId})
       WHERE type(r) IN ['FRIENDS_WITH']
       RETURN true AS exists`,
      { userId, targetId }
    )
    return !!result?.exists
  },

  async getParticipantIds(conversationRef: string): Promise<string[]> {
    const results = await runQuery<{ userId: string }>(
      `MATCH (u:User)-[:PARTICIPATES_IN]-(c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       RETURN u.userId AS userId`,
      { conversationRef }
    )
    return results.map(r => r.userId)
  },

  async acceptMessageRequest(conversationRef: string, userId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       SET c.requestStatus = 'ACCEPTED',
           c.updatedAt = $now`,
      { conversationRef, userId, now: new Date().toISOString() }
    )
  },

  async getConversationMeta(conversationRef: string): Promise<Pick<Conversation, 'requestStatus' | 'requesterId'>> {
    const result = await runQueryOne<{
      requestStatus: Conversation['requestStatus'] | null
      requesterId: string | null
    }>(
      `MATCH (c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       RETURN coalesce(c.requestStatus, 'ACCEPTED') AS requestStatus,
              c.requesterId AS requesterId
       LIMIT 1`,
      { conversationRef }
    )
    return {
      requestStatus: result?.requestStatus ?? 'ACCEPTED',
      requesterId: result?.requesterId ?? undefined,
    }
  },

  async deleteConversation(conversationRef: string, userId: string): Promise<{ deleted: boolean }> {
    const result = await runQueryOne<{ deleted: boolean }>(
      `MATCH (u:User {userId: $userId})-[:PARTICIPATES_IN]-(c:Conversation)
       WHERE c.conversationId = $conversationRef OR c.directKey = $conversationRef
       MERGE (u)-[hidden:HIDDEN_CONVERSATION]->(c)
       SET hidden.hiddenAt = $now
       WITH c
       MATCH (participant:User)-[:PARTICIPATES_IN]-(c)
       WITH c, count(DISTINCT participant) AS participantCount
       OPTIONAL MATCH (hiddenUser:User)-[:HIDDEN_CONVERSATION]->(c)
       WITH c, participantCount, count(DISTINCT hiddenUser) AS hiddenCount
       CALL {
         WITH c, participantCount, hiddenCount
         WITH c WHERE participantCount > 0 AND hiddenCount >= participantCount
         DETACH DELETE c
         RETURN true AS deleted
         UNION
         WITH c, participantCount, hiddenCount
         RETURN false AS deleted
       }
       RETURN deleted`,
      { conversationRef, userId, now: new Date().toISOString() }
    )
    return { deleted: !!result?.deleted }
  },

  async createGroupConversation(creatorId: string, name: string, participantIds: string[], avatarUrl?: string): Promise<Conversation> {
    const now = new Date().toISOString()
    const conversationId = uuidv4()
    const allIds = Array.from(new Set([creatorId, ...participantIds]))

    const result = await runQueryOne<{ c: { properties: Conversation } }>(
      `CREATE (c:Conversation {
         conversationId: $conversationId,
         type: 'GROUP',
         name: $name,
         creatorId: $creatorId,
         avatarUrl: $avatarUrl,
         createdAt: $now,
         updatedAt: $now,
         lastMessageAt: $now
       })
       WITH c
       UNWIND $allIds AS uid
       MATCH (u:User)
       WHERE replace(trim(coalesce(u.userId, '')), ' ', '-') = uid
       MERGE (u)-[:PARTICIPATES_IN]->(c)
       WITH c
       RETURN DISTINCT c`,
      { conversationId, name, creatorId, avatarUrl: avatarUrl ?? null, now, allIds }
    )
    return result!.c.properties
  },

  async getGroupInfo(conversationRef: string): Promise<{ name: string; avatarUrl?: string; creatorId: string } | null> {
    const result = await runQueryOne<{ name: string; avatarUrl: string | null; creatorId: string }>(
      `MATCH (c:Conversation)
       WHERE c.conversationId = $conversationRef
         AND c.type = 'GROUP'
       RETURN c.name AS name, c.avatarUrl AS avatarUrl, c.creatorId AS creatorId`,
      { conversationRef }
    )
    if (!result) return null
    return {
      name: result.name,
      avatarUrl: result.avatarUrl ?? undefined,
      creatorId: result.creatorId,
    }
  },

  async updateGroupInfo(conversationRef: string, data: { name?: string; avatarUrl?: string }): Promise<void> {
    await runQuery(
      `MATCH (c:Conversation {conversationId: $conversationRef, type: 'GROUP'})
       SET c.name = coalesce($name, c.name),
           c.avatarUrl = coalesce($avatarUrl, c.avatarUrl),
           c.updatedAt = $now`,
      { conversationRef, name: data.name ?? null, avatarUrl: data.avatarUrl ?? null, now: new Date().toISOString() }
    )
  },
}



