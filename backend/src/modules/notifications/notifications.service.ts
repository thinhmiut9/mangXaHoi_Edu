import { notificationsRepository } from './notifications.repository'
import { pushNotification } from '../../socket'
import { runQueryOne } from '../../config/neo4j'
import { UserPublic } from '../../types'

export const notificationsService = {
  async getNotifications(userId: string, page = 1, limit = 20) {
    return notificationsRepository.findByUser(userId, (page - 1) * limit, limit)
  },

  async markRead(notificationId: string, userId: string) {
    await notificationsRepository.markRead(notificationId, userId)
  },

  async markAllRead(userId: string) {
    await notificationsRepository.markAllRead(userId)
  },

  async deleteById(notificationId: string, userId: string) {
    await notificationsRepository.deleteById(notificationId, userId)
  },

  async getUnreadCount(userId: string) {
    return notificationsRepository.countUnread(userId)
  },

  async getUnreadSummary(userId: string) {
    return notificationsRepository.countUnreadSummary(userId)
  },

  async markMessageNotificationsReadFromSenders(userId: string, senderIds: string[]) {
    await notificationsRepository.markMessageNotificationsReadFromSenders(userId, senderIds)
  },

  // Called internally by other services (like, comment, friend)
  async push(data: {
    recipientId: string
    senderId: string
    type: import('../../types').NotificationType
    entityId?: string
    entityType?: string
    content: string
  }) {
    if (data.recipientId === data.senderId) return // Don't notify yourself
    const notification = await notificationsRepository.create(data)
    const sender = await runQueryOne<{ u: { properties: UserPublic } }>(
      `MATCH (u:User {userId: $senderId}) RETURN u`,
      { senderId: data.senderId }
    )
    pushNotification(data.recipientId, {
      ...notification,
      sender: sender?.u.properties,
    })
  },
}

