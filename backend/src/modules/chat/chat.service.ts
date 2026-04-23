import { v4 as uuidv4 } from 'uuid'
import { chatRepository } from './chat.repository'
import { AppError } from '../../middleware/errorHandler'
import { pushConversationMessage } from '../../socket'
import { notificationsService } from '../notifications/notifications.service'
import { friendsRepository } from '../friends/friends.repository'

export const chatService = {
  async getConversations(userId: string) {
    return chatRepository.getConversations(userId)
  },

  async getOrCreateDirectConversation(userId: string, targetId: string) {
    if (userId === targetId) throw new AppError('Khong the tu nhan tin cho chinh minh', 400)
    const isBlocked = await friendsRepository.isBlockedBetween(userId, targetId)
    if (isBlocked) throw new AppError('Khong the nhan tin do da bi chan', 403)
    // Allow messaging anyone (friends + strangers). requestStatus managed on conversation.
    return chatRepository.findOrCreateDirect(userId, targetId)
  },

  async getMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen truy cap cuoc tro chuyen', 403)
    const participantIds = await chatRepository.getParticipantIds(conversationId)
    const isBlocked = await Promise.all(
      participantIds
        .filter((id) => id !== userId)
        .map((id) => friendsRepository.isBlockedBetween(userId, id))
    ).then((items) => items.some(Boolean))
    if (isBlocked) throw new AppError('Cuoc tro chuyen khong kha dung do quan he chan', 403)
    const skip = (page - 1) * limit
    return chatRepository.getMessages(conversationId, userId, skip, limit)
  },

  async sendMessage(conversationId: string, userId: string, content: string) {
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen gui tin nhan', 403)
    const participantIds = await chatRepository.getParticipantIds(conversationId)
    const isBlocked = await Promise.all(
      participantIds
        .filter((id) => id !== userId)
        .map((id) => friendsRepository.isBlockedBetween(userId, id))
    ).then((items) => items.some(Boolean))
    if (isBlocked) throw new AppError('Khong the gui tin nhan do da bi chan', 403)

    const message = await chatRepository.createMessage({ messageId: uuidv4(), conversationId, senderId: userId, content })
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

  async acceptMessageRequest(conversationId: string, userId: string) {
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen truy cap cuoc tro chuyen', 403)
    await chatRepository.acceptMessageRequest(conversationId, userId)
  },

  async getConversationMeta(conversationId: string, userId: string) {
    const isParticipant = await chatRepository.isParticipant(conversationId, userId)
    if (!isParticipant) throw new AppError('Khong co quyen truy cap cuoc tro chuyen', 403)
    return chatRepository.getConversationMeta(conversationId)
  },
}
