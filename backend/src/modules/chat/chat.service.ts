import { v4 as uuidv4 } from 'uuid'
import { chatRepository } from './chat.repository'
import { AppError } from '../../middleware/errorHandler'
import { pushConversationMessage } from '../../socket'
import { notificationsService } from '../notifications/notifications.service'

export const chatService = {
  async getConversations(userId: string) {
    return chatRepository.getConversations(userId)
  },

  async getOrCreateDirectConversation(userId: string, targetId: string) {
    if (userId === targetId) throw new AppError('Khong the tu nhan tin cho chinh minh', 400)
    const areFriends = await chatRepository.areFriends(userId, targetId)
    if (!areFriends) throw new AppError('Chi co the nhan tin voi ban be', 403)
    return chatRepository.findOrCreateDirect(userId, targetId)
  },

  async getMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen truy cap cuoc tro chuyen', 403)
    const skip = (page - 1) * limit
    return chatRepository.getMessages(conversationId, userId, skip, limit)
  },

  async sendMessage(conversationId: string, userId: string, content: string) {
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen gui tin nhan', 403)

    const message = await chatRepository.createMessage({ messageId: uuidv4(), conversationId, senderId: userId, content })
    const participantIds = await chatRepository.getParticipantIds(conversationId)
    pushConversationMessage(conversationId, message, participantIds)

    const recipientIds = participantIds.filter(id => id !== userId)
    await Promise.all(recipientIds.map(recipientId =>
      notificationsService.push({
        recipientId,
        senderId: userId,
        type: 'MESSAGE',
        entityId: conversationId,
        entityType: 'CONVERSATION',
        content: 'đã gửi cho bạn một tin nhắn mới.',
      })
    ))

    return message
  },

  async markAsRead(conversationId: string, userId: string) {
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen truy cap cuoc tro chuyen', 403)

    await chatRepository.markAsRead(conversationId, userId)
    const participantIds = await chatRepository.getParticipantIds(conversationId)
    const otherUserIds = participantIds.filter(id => id !== userId)
    await notificationsService.markMessageNotificationsReadFromSenders(userId, otherUserIds)
  },

  async deleteConversation(conversationId: string, userId: string) {
    const exists = await chatRepository.existsByRef(conversationId)
    if (!exists) return
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen xoa cuoc tro chuyen', 403)
    await chatRepository.deleteConversation(conversationId, userId)
  },
}
