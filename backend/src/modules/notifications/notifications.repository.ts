import { runQuery, runQueryOne } from '../../config/neo4j'
import { Notification, NotificationType, UserPublic } from '../../types'
import { v4 as uuidv4 } from 'uuid'

export const notificationsRepository = {
  async create(data: {
    recipientId: string
    senderId: string
    type: NotificationType
    content: string
    entityId?: string
    entityType?: string
  }): Promise<Notification> {
    const now = new Date().toISOString()
    const result = await runQueryOne<{ n: { properties: Notification } }>(
      `MATCH (recipient:User {userId: $recipientId})
       CREATE (n:Notification {
         notificationId: $notificationId,
         type: $type,
         senderId: $senderId,
         content: $content,
         entityId: $entityId,
         entityType: $entityType,
         isRead: false,
         createdAt: $now
       })
       CREATE (recipient)-[:HAS_NOTIFICATION]->(n)
       RETURN n`,
      { notificationId: uuidv4(), ...data, now }
    )
    return result!.n.properties
  },

  async findByUser(userId: string, skip = 0, limit = 20): Promise<Notification[]> {
    const results = await runQuery<{ n: { properties: Notification }; sender: { properties: Record<string, unknown> } | null }>(
      `MATCH (u:User {userId: $userId})-[:HAS_NOTIFICATION]->(n:Notification)
       OPTIONAL MATCH (sender:User {userId: n.senderId})
       RETURN n, sender ORDER BY n.createdAt DESC SKIP toInteger($skip) LIMIT toInteger($limit)`,
      { userId, skip, limit }
    )
    return results.map(r => ({
      ...r.n.properties,
      sender: r.sender?.properties as unknown as UserPublic | undefined,
    }))
  },

  async markRead(notificationId: string, userId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[:HAS_NOTIFICATION]->(n:Notification {notificationId: $notificationId})
       SET n.isRead = true`,
      { notificationId, userId }
    )
  },

  async markAllRead(userId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[:HAS_NOTIFICATION]->(n:Notification {isRead: false})
       SET n.isRead = true`,
      { userId }
    )
  },

  async deleteById(notificationId: string, userId: string): Promise<void> {
    await runQuery(
      `MATCH (u:User {userId: $userId})-[:HAS_NOTIFICATION]->(n:Notification {notificationId: $notificationId})
       DETACH DELETE n`,
      { notificationId, userId }
    )
  },

  async countUnread(userId: string): Promise<number> {
    const result = await runQueryOne<{ count: number }>(
      `MATCH (u:User {userId: $userId})-[:HAS_NOTIFICATION]->(n:Notification {isRead: false})
       RETURN count(n) AS count`,
      { userId }
    )
    return result?.count ?? 0
  },

  async countUnreadSummary(userId: string): Promise<{ notificationCount: number; messageCount: number }> {
    const result = await runQueryOne<{ notificationCount: number; messageCount: number }>(
      `MATCH (u:User {userId: $userId})-[:HAS_NOTIFICATION]->(n:Notification {isRead: false})
       RETURN
         count(CASE WHEN n.type <> 'MESSAGE' THEN 1 END) AS notificationCount,
         count(CASE WHEN n.type = 'MESSAGE' THEN 1 END) AS messageCount`,
      { userId }
    )
    return {
      notificationCount: result?.notificationCount ?? 0,
      messageCount: result?.messageCount ?? 0,
    }
  },

  async markMessageNotificationsReadFromSenders(userId: string, senderIds: string[]): Promise<void> {
    if (!senderIds.length) return
    await runQuery(
      `MATCH (u:User {userId: $userId})-[:HAS_NOTIFICATION]->(n:Notification {isRead: false, type: 'MESSAGE'})
       WHERE n.senderId IN $senderIds
       SET n.isRead = true`,
      { userId, senderIds }
    )
  },
}


