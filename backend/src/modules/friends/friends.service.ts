import { friendsRepository } from './friends.repository'
import { AppError } from '../../middleware/errorHandler'
import { notificationsService } from '../notifications/notifications.service'
import { recommendationFileService } from './recommendationFile.service'

export const friendsService = {
  async getFriends(userId: string, page?: number, limit?: number) {
    const skip = page && limit ? (page - 1) * limit : 0
    return friendsRepository.getFriends(userId, skip, limit)
  },

  async getRequests(userId: string) {
    return friendsRepository.getPendingRequests(userId)
  },

  async getSentRequests(userId: string) {
    return friendsRepository.getSentRequests(userId)
  },

  async getSuggestions(userId: string, limit = 10) {
    const fileRecommendations = recommendationFileService.getRecommendations(userId)

    if (fileRecommendations.length > 0) {
      const recommendedIds = fileRecommendations.map((item) => item.recommendedUserId)
      const users = await friendsRepository.getSuggestionsFromIds(userId, recommendedIds, limit)
      const metaByUserId = new Map(fileRecommendations.map((item) => [item.recommendedUserId, item]))

      if (users.length > 0) {
        return users.map((user) => {
          const meta = metaByUserId.get(user.userId)
          return {
            ...user,
            rank: meta?.rank ?? null,
            similarityScore: meta?.similarityScore ?? null,
            recommendationSource: 'node2vec_file',
          }
        })
      }
    }

    const fallbackUsers = await friendsRepository.getSuggestions(userId, limit)
    return fallbackUsers.map((user) => ({
      ...user,
      recommendationSource: 'mutual_friends',
    }))
  },

  async getBlockedUsers(userId: string) {
    return friendsRepository.getBlockedUsers(userId)
  },

  async sendRequest(userId: string, targetId: string) {
    if (userId === targetId) throw new AppError('Khong the ket ban voi chinh minh', 400)
    const isBlocked = await friendsRepository.isBlockedBetween(userId, targetId)
    if (isBlocked) throw new AppError('Khong the ket ban do da bi chan', 403)
    const { status } = await friendsRepository.getStatus(userId, targetId)
    if (status === 'ACCEPTED') throw new AppError('Da la ban be', 409)
    if (status === 'PENDING') throw new AppError('Da gui loi moi ket ban', 409)
    if (status === 'PENDING_RECEIVED') throw new AppError('Ban da nhan loi moi tu nguoi nay', 409)
    await friendsRepository.sendRequest(userId, targetId)

    await notificationsService.push({
      recipientId: targetId,
      senderId: userId,
      type: 'FRIEND_REQUEST',
      entityId: userId,
      entityType: 'USER',
      content: 'đã gửi cho bạn một lời mời kết bạn.',
    })
  },

  async acceptRequest(userId: string, requesterId: string) {
    const isBlocked = await friendsRepository.isBlockedBetween(userId, requesterId)
    if (isBlocked) throw new AppError('Khong the chap nhan do da bi chan', 403)
    await friendsRepository.acceptRequest(userId, requesterId)
    await notificationsService.push({
      recipientId: requesterId,
      senderId: userId,
      type: 'FRIEND_ACCEPTED',
      entityId: userId,
      entityType: 'USER',
      content: 'đã chấp nhận lời mời kết bạn của bạn.',
    })
  },

  async rejectRequest(userId: string, requesterId: string) {
    await friendsRepository.rejectRequest(userId, requesterId)
  },

  async cancelRequest(userId: string, targetId: string) {
    await friendsRepository.cancelRequest(userId, targetId)
  },

  async unfriend(userId: string, targetId: string) {
    await friendsRepository.unfriend(userId, targetId)
  },

  async blockUser(userId: string, targetId: string) {
    if (userId === targetId) throw new AppError('Khong the chan chinh minh', 400)
    await friendsRepository.blockUser(userId, targetId)
  },

  async unblockUser(userId: string, targetId: string) {
    if (userId === targetId) throw new AppError('Khong the bo chan chinh minh', 400)
    await friendsRepository.unblockUser(userId, targetId)
  },

  async getStatus(userId: string, targetId: string) {
    return friendsRepository.getStatus(userId, targetId)
  },
}
