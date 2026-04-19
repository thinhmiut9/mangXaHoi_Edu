import { v4 as uuidv4 } from 'uuid'
import { commentsRepository } from './comments.repository'
import { AppError } from '../../middleware/errorHandler'
import { CreateCommentDto } from './comments.schema'
import { notificationsService } from '../notifications/notifications.service'
import { extractMentionedUserIds } from '../../utils/mention'

export const commentsService = {
  async getComments(postId: string, viewerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    return commentsRepository.findByPost(postId, viewerId, skip, limit)
  },

  async createComment(postId: string, userId: string, dto: CreateCommentDto) {
    const comment = await commentsRepository.create({ commentId: uuidv4(), ...dto, postId, authorId: userId })
    const postAuthorId = await commentsRepository.getPostAuthorId(postId)
    if (postAuthorId) {
      await notificationsService.push({
        recipientId: postAuthorId,
        senderId: userId,
        type: 'POST_COMMENT',
        entityId: postId,
        entityType: 'POST',
        content: 'đã bình luận bài viết của bạn.',
      })
    }

    // Gửi MENTION notification cho những người được tag trong bình luận
    const mentionedIds = await extractMentionedUserIds(dto.content ?? '')
    await Promise.all(
      mentionedIds
        .filter(id => id !== userId && id !== postAuthorId)
        .map(id =>
          notificationsService.push({
            recipientId: id,
            senderId: userId,
            type: 'MENTION',
            entityId: postId,
            entityType: 'POST',
            content: 'đã nhắc đến bạn trong một bình luận.',
          })
        )
    )

    return comment
  },

  async updateComment(commentId: string, userId: string, content: string) {
    const isAuthor = await commentsRepository.isAuthor(commentId, userId)
    if (!isAuthor) throw new AppError('Không có quyền chỉnh sửa', 403, 'FORBIDDEN')
    return commentsRepository.update(commentId, content)
  },

  async deleteComment(commentId: string, userId: string, userRole: string) {
    const isAuthor = await commentsRepository.isAuthor(commentId, userId)
    if (!isAuthor && userRole !== 'ADMIN') throw new AppError('Không có quyền xóa', 403, 'FORBIDDEN')
    await commentsRepository.delete(commentId)
  },

  async toggleLike(commentId: string, userId: string) {
    const result = await commentsRepository.toggleLike(commentId, userId)
    if (result.liked) {
      const [commentAuthorId, postId] = await Promise.all([
        commentsRepository.getCommentAuthorId(commentId),
        commentsRepository.getPostIdByCommentId(commentId),
      ])
      if (commentAuthorId) {
        await notificationsService.push({
          recipientId: commentAuthorId,
          senderId: userId,
          type: 'POST_REACT',
          // Dùng postId để frontend navigate được đến bài viết
          entityId: postId ?? commentId,
          entityType: postId ? 'POST' : 'COMMENT',
          content: 'đã thả cảm xúc cho bình luận của bạn.',
        })
      }
    }
    return result
  },
}

