import { v4 as uuidv4 } from 'uuid'
import { postsRepository } from './posts.repository'
import { AppError } from '../../middleware/errorHandler'
import { CreatePostDto, UpdatePostDto } from './posts.schema'
import { paginationMeta } from '../../utils/response'
import { filterCloudinaryImageUrls } from '../../utils/cloudinary'
import { Post } from '../../types'
import { friendsRepository } from '../friends/friends.repository'
import { notificationsService } from '../notifications/notifications.service'
import { groupsRepository } from '../groups/groups.repository'

function sanitizePostMedia(post: Post): Post {
  return {
    ...post,
    mediaUrls: filterCloudinaryImageUrls(post.mediaUrls),
  }
}

export const postsService = {
  async getFeed(viewerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const rows = await postsRepository.getFeed(viewerId, skip, limit + 1)
    const hasNext = rows.length > limit
    const posts = hasNext ? rows.slice(0, limit) : rows
    const estimatedTotal = skip + posts.length + (hasNext ? 1 : 0)
    return { posts: posts.map(sanitizePostMedia), meta: paginationMeta(page, limit, estimatedTotal) }
  },

  async createPost(userId: string, dto: CreatePostDto) {
    if (dto.visibility === 'GROUP') {
      if (!dto.groupId) throw new AppError('Thiếu groupId cho bài viết nhóm', 400, 'GROUP_ID_REQUIRED')
      const group = await groupsRepository.findById(dto.groupId)
      if (!group) throw new AppError('Nhóm không tồn tại', 404, 'GROUP_NOT_FOUND')
      const isMember = await groupsRepository.isMember(dto.groupId, userId)
      if (!isMember) throw new AppError('Bạn chưa tham gia nhóm', 403, 'FORBIDDEN')
    }

    const post = await postsRepository.create({ postId: uuidv4(), ...dto, authorId: userId })
    const friendIds = await friendsRepository.getFriendIds(userId)
    await Promise.all(friendIds.map(friendId =>
      notificationsService.push({
        recipientId: friendId,
        senderId: userId,
        type: 'NEW_POST',
        entityId: post.postId,
        entityType: 'POST',
        content: 'vừa đăng một bài viết mới.',
      })
    ))
    return sanitizePostMedia(post)
  },

  async getPost(postId: string, viewerId?: string) {
    const post = await postsRepository.findById(postId, viewerId)
    if (!post) throw new AppError('Bài viết không tồn tại', 404, 'POST_NOT_FOUND')
    return sanitizePostMedia(post)
  },

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    const isAuthor = await postsRepository.isAuthor(postId, userId)
    if (!isAuthor) throw new AppError('Bạn không có quyền chỉnh sửa bài viết này', 403, 'FORBIDDEN')
    const updated = await postsRepository.update(postId, dto)
    if (!updated) throw new AppError('Cập nhật thất bại', 500)
    return sanitizePostMedia(updated)
  },

  async deletePost(postId: string, userId: string, userRole: string) {
    const isAuthor = await postsRepository.isAuthor(postId, userId)
    if (!isAuthor && userRole !== 'ADMIN') {
      throw new AppError('Bạn không có quyền xóa bài viết này', 403, 'FORBIDDEN')
    }
    await postsRepository.delete(postId)
  },

  async toggleLike(postId: string, userId: string) {
    const post = await postsRepository.findById(postId)
    if (!post) throw new AppError('Bài viết không tồn tại', 404, 'POST_NOT_FOUND')
    const result = await postsRepository.toggleLike(postId, userId)
    if (result.liked) {
      const authorId = await postsRepository.getAuthorId(postId)
      if (authorId) {
        await notificationsService.push({
          recipientId: authorId,
          senderId: userId,
          type: 'POST_REACT',
          entityId: postId,
          entityType: 'POST',
          content: 'đã thích bài viết của bạn.',
        })
      }
    }
    return result
  },

  async toggleSave(postId: string, userId: string) {
    const post = await postsRepository.findById(postId)
    if (!post) throw new AppError('Bài viết không tồn tại', 404, 'POST_NOT_FOUND')
    return postsRepository.toggleSave(postId, userId)
  },

  async sharePost(postId: string, userId: string) {
    const post = await postsRepository.findById(postId)
    if (!post) throw new AppError('Bài viết không tồn tại', 404, 'POST_NOT_FOUND')
    return postsRepository.sharePost(postId, userId)
  },

  async getReactions(postId: string) {
    const post = await postsRepository.findById(postId)
    if (!post) throw new AppError('Bài viết không tồn tại', 404, 'POST_NOT_FOUND')
    return postsRepository.getReactions(postId)
  },

  async getSavedPosts(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const posts = await postsRepository.getSavedPosts(userId, skip, limit)
    return { posts: posts.map(sanitizePostMedia), meta: paginationMeta(page, limit, posts.length + skip) }
  },

  async getUserPosts(userId: string, viewerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const posts = await postsRepository.getUserPosts(userId, viewerId, skip, limit)
    return { posts: posts.map(sanitizePostMedia), meta: paginationMeta(page, limit, posts.length + skip) }
  },

  async getGroupPosts(groupId: string, viewerId: string, page: number, limit: number) {
    const group = await groupsRepository.findById(groupId)
    if (!group) throw new AppError('Nhóm không tồn tại', 404, 'GROUP_NOT_FOUND')

    const isMember = await groupsRepository.isMember(groupId, viewerId)
    if (!isMember) throw new AppError('Bạn cần tham gia nhóm để xem thảo luận', 403, 'FORBIDDEN')

    const skip = (page - 1) * limit
    const posts = await postsRepository.getGroupPosts(groupId, viewerId, skip, limit)
    return { posts: posts.map(sanitizePostMedia), meta: paginationMeta(page, limit, posts.length + skip) }
  },
}
