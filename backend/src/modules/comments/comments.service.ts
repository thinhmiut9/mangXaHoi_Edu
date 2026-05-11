import { v4 as uuidv4 } from 'uuid'
import { commentsRepository } from './comments.repository'
import { AppError } from '../../middleware/errorHandler'
import { CreateCommentDto } from './comments.schema'
import { notificationsService } from '../notifications/notifications.service'
import { extractMentionedUserIds } from '../../utils/mention'
import { profanityService } from '../moderation/profanity.service'

function assertCommentContentAllowed(content: string) {
  const result = profanityService.scanText(content, 'comment')
  if (result.action !== 'block') return

  const matchedKeywords = result.matchedRules.map((rule) => rule.keyword).join(', ')
  const message = 'Nội dung bình luận chứa từ ngữ không phù hợp.'

  throw new AppError(message, 422, 'PROFANITY_DETECTED', {
    content: [`Matched keywords: ${matchedKeywords}`],
  })
}

export const commentsService = {
  async getComments(postId: string, viewerId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    return commentsRepository.findByPost(postId, viewerId, skip, limit)
  },

  async createComment(postId: string, userId: string, dto: CreateCommentDto) {
    assertCommentContentAllowed(dto.content)

    const comment = await commentsRepository.create({ commentId: uuidv4(), ...dto, postId, authorId: userId })
    const postAuthorId = await commentsRepository.getPostAuthorId(postId)
    if (postAuthorId) {
      await notificationsService.push({
        recipientId: postAuthorId,
        senderId: userId,
        type: 'POST_COMMENT',
        entityId: postId,
        entityType: 'POST',
        content: 'da binh luan bai viet cua ban.',
      })
    }

    const mentionedIds = await extractMentionedUserIds(dto.content ?? '')
    await Promise.all(
      mentionedIds
        .filter((id) => id !== userId && id !== postAuthorId)
        .map((id) =>
          notificationsService.push({
            recipientId: id,
            senderId: userId,
            type: 'MENTION',
            entityId: postId,
            entityType: 'POST',
            content: 'da nhac den ban trong mot binh luan.',
          })
        )
    )

    return comment
  },

  async updateComment(commentId: string, userId: string, content: string) {
    const isAuthor = await commentsRepository.isAuthor(commentId, userId)
    if (!isAuthor) throw new AppError('Khong co quyen chinh sua', 403, 'FORBIDDEN')

    assertCommentContentAllowed(content)
    return commentsRepository.update(commentId, content)
  },

  async deleteComment(commentId: string, userId: string, userRole: string) {
    const isAuthor = await commentsRepository.isAuthor(commentId, userId)
    if (!isAuthor && userRole !== 'ADMIN') throw new AppError('Khong co quyen xoa', 403, 'FORBIDDEN')
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
          entityId: postId ?? commentId,
          entityType: postId ? 'POST' : 'COMMENT',
          content: 'da tha cam xuc cho binh luan cua ban.',
        })
      }
    }
    return result
  },
}
