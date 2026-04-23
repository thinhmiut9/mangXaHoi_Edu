import { v4 as uuidv4 } from 'uuid'
import { postsRepository } from './posts.repository'
import { AppError } from '../../middleware/errorHandler'
import { CreatePostDto, UpdatePostDto } from './posts.schema'
import { paginationMeta } from '../../utils/response'
import {
  filterCloudinaryImageUrls,
  filterCloudinaryMediaUrls,
  filterCloudinaryRawUrls,
  filterCloudinaryVideoUrls,
  isCloudinaryMediaUrl,
} from '../../utils/cloudinary'
import { Post } from '../../types'
import { friendsRepository } from '../friends/friends.repository'
import { notificationsService } from '../notifications/notifications.service'
import { groupsRepository } from '../groups/groups.repository'
import { cloudinaryV2 } from '../../config/cloudinary'
import { extractMentionedUserIds } from '../../utils/mention'
import { usersRepository } from '../users/users.repository'

function sanitizePostMedia(post: Post): Post {
  const imageUrls = filterCloudinaryImageUrls(post.imageUrls)
  const videoUrls = filterCloudinaryVideoUrls(post.videoUrls)
  const documentUrls = filterCloudinaryRawUrls(post.documentUrls)
  const legacyMediaUrls = filterCloudinaryMediaUrls(post.mediaUrls)

  const imageSet = new Set(imageUrls)
  const videoSet = new Set(videoUrls)
  const documentSet = new Set(documentUrls)

  for (const url of legacyMediaUrls) {
    const asset = parseCloudinaryAsset(url)
    if (!asset) continue
    if (asset.resourceType === 'image') imageSet.add(url)
    if (asset.resourceType === 'video') videoSet.add(url)
    if (asset.resourceType === 'raw') documentSet.add(url)
  }

  const normalizedImageUrls = Array.from(imageSet)
  const normalizedVideoUrls = Array.from(videoSet)
  const normalizedDocumentUrls = Array.from(documentSet)

  return {
    ...post,
    imageUrls: normalizedImageUrls,
    videoUrls: normalizedVideoUrls,
    documentUrls: normalizedDocumentUrls,
    mediaUrls: [...normalizedImageUrls, ...normalizedVideoUrls],
  }
}

type CloudinaryResourceType = 'image' | 'video' | 'raw'

function parseCloudinaryAsset(url: string): { resourceType: CloudinaryResourceType; publicId: string } | null {
  if (!isCloudinaryMediaUrl(url)) return null

  let pathname = ''
  try {
    pathname = new URL(url).pathname
  } catch {
    return null
  }

  let resourceType: CloudinaryResourceType | null = null
  if (pathname.includes('/image/upload/')) resourceType = 'image'
  if (pathname.includes('/video/upload/')) resourceType = 'video'
  if (pathname.includes('/raw/upload/')) resourceType = 'raw'
  if (!resourceType) return null

  const uploadMarker = '/upload/'
  const uploadIndex = pathname.indexOf(uploadMarker)
  if (uploadIndex === -1) return null

  const afterUpload = pathname.slice(uploadIndex + uploadMarker.length)
  const segments = afterUpload.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const versionIndex = segments.findIndex(segment => /^v\d+$/.test(segment))
  const publicSegments = versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments
  if (publicSegments.length === 0) return null

  const joinedPublicPath = publicSegments.join('/')
  const publicId =
    resourceType === 'raw' ? joinedPublicPath : joinedPublicPath.replace(/\.[^/.]+$/, '')

  if (!publicId) return null
  return { resourceType, publicId }
}

async function cleanupCloudinaryMedia(urls: string[]): Promise<void> {
  const cloudinaryAssets = urls
    .map(parseCloudinaryAsset)
    .filter((asset): asset is { resourceType: CloudinaryResourceType; publicId: string } => !!asset)

  if (cloudinaryAssets.length === 0) return

  const dedupMap = new Map<string, { resourceType: CloudinaryResourceType; publicId: string }>()
  for (const asset of cloudinaryAssets) {
    dedupMap.set(`${asset.resourceType}:${asset.publicId}`, asset)
  }
  const uniqueAssets = Array.from(dedupMap.values())

  const results = await Promise.allSettled(
    uniqueAssets.map(asset =>
      cloudinaryV2.uploader.destroy(asset.publicId, { resource_type: asset.resourceType })
    )
  )

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const asset = uniqueAssets[index]
      console.warn(
        `[posts] Cloudinary delete failed: ${asset.resourceType}/${asset.publicId}`,
        result.reason
      )
    }
  })
}

function normalizeIncomingMedia(dto: Pick<CreatePostDto, 'imageUrls' | 'videoUrls' | 'documentUrls' | 'mediaUrls'>) {
  const imageSet = new Set(filterCloudinaryImageUrls(dto.imageUrls))
  const videoSet = new Set(filterCloudinaryVideoUrls(dto.videoUrls))
  const documentSet = new Set(filterCloudinaryRawUrls(dto.documentUrls))
  const legacyMedia = filterCloudinaryMediaUrls(dto.mediaUrls)

  for (const url of legacyMedia) {
    const asset = parseCloudinaryAsset(url)
    if (!asset) continue
    if (asset.resourceType === 'image') imageSet.add(url)
    if (asset.resourceType === 'video') videoSet.add(url)
    if (asset.resourceType === 'raw') documentSet.add(url)
  }

  const imageUrls = Array.from(imageSet)
  const videoUrls = Array.from(videoSet)
  const documentUrls = Array.from(documentSet)

  return {
    imageUrls,
    videoUrls,
    documentUrls,
    mediaUrls: [...imageUrls, ...videoUrls],
  }
}

/** Batch-fetch original posts for shared posts and attach as originalPost */
async function enrichPostsWithOriginal(posts: Post[]): Promise<Post[]> {
  const ids = [...new Set(posts.map(p => (p as any).sharedFromPostId).filter(Boolean))]
  if (!ids.length) return posts
  const originalMap = await postsRepository.findManyByIds(ids)
  return posts.map(post => {
    const sharedFrom = (post as any).sharedFromPostId
    if (!sharedFrom || !originalMap[sharedFrom]) return post
    const original = sanitizePostMedia(originalMap[sharedFrom])
    return { ...post, originalPost: original } as Post
  })
}

export const postsService = {
  async getFeed(viewerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const rows = await postsRepository.getFeed(viewerId, skip, limit + 1)
    const hasNext = rows.length > limit
    const posts = hasNext ? rows.slice(0, limit) : rows
    const estimatedTotal = skip + posts.length + (hasNext ? 1 : 0)
    const enriched = await enrichPostsWithOriginal(posts.map(sanitizePostMedia))
    return { posts: enriched, meta: paginationMeta(page, limit, estimatedTotal) }
  },

  async createPost(userId: string, dto: CreatePostDto) {
    if (dto.visibility === 'GROUP') {
      if (!dto.groupId) throw new AppError('Thiếu groupId cho bài viết nhóm', 400, 'GROUP_ID_REQUIRED')
      const group = await groupsRepository.findById(dto.groupId)
      if (!group) throw new AppError('Nhóm không tồn tại', 404, 'GROUP_NOT_FOUND')
      const isMember = await groupsRepository.isMember(dto.groupId, userId)
      if (!isMember) throw new AppError('Bạn chưa tham gia nhóm', 403, 'FORBIDDEN')
    }

    const media = normalizeIncomingMedia(dto)
    const post = await postsRepository.create({
      postId: uuidv4(),
      content: dto.content,
      visibility: dto.visibility,
      groupId: dto.groupId,
      ...media,
      authorId: userId,
    })
    await postsRepository.attachDocuments(post.postId, userId, media.documentUrls)
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

    // Gửi MENTION notification cho những người được tag
    const mentionedIds = await extractMentionedUserIds(dto.content ?? '')
    await Promise.all(
      mentionedIds
        .filter(id => id !== userId)
        .map(id =>
          notificationsService.push({
            recipientId: id,
            senderId: userId,
            type: 'MENTION',
            entityId: post.postId,
            entityType: 'POST',
            content: 'đã nhắc đến bạn trong một bài viết.',
          })
        )
    )

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
    const hasMediaInput =
      dto.imageUrls !== undefined ||
      dto.videoUrls !== undefined ||
      dto.documentUrls !== undefined ||
      dto.mediaUrls !== undefined

    const payload: {
      content?: string
      visibility?: string
      mediaUrls?: string[]
    } = {
      content: dto.content,
      visibility: dto.visibility,
    }

    if (hasMediaInput) {
      payload.mediaUrls = normalizeIncomingMedia(dto).mediaUrls
    }

    const updated = await postsRepository.update(postId, payload)
    if (!updated) throw new AppError('Cập nhật thất bại', 500)
    return sanitizePostMedia(updated)
  },

  async deletePost(postId: string, userId: string, userRole: string) {
    const isAuthor = await postsRepository.isAuthor(postId, userId)
    if (!isAuthor && userRole !== 'ADMIN') {
      throw new AppError('Bạn không có quyền xóa bài viết này', 403, 'FORBIDDEN')
    }

    const mediaUrls = await postsRepository.getMediaUrls(postId)
    await cleanupCloudinaryMedia(mediaUrls)
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

  async togglePin(postId: string, userId: string) {
    const post = await postsRepository.findById(postId)
    if (!post) throw new AppError('Bài viết không tồn tại', 404, 'POST_NOT_FOUND')

    const isAuthor = await postsRepository.isAuthor(postId, userId)
    if (!isAuthor) throw new AppError('Bạn chỉ có thể ghim bài viết của chính mình', 403, 'FORBIDDEN')

    const isGroupPost = Boolean(post.groupId && post.groupId !== 'null')
    if (isGroupPost) throw new AppError('Không thể ghim bài viết nhóm lên trang cá nhân', 400, 'INVALID_PIN_TARGET')

    return postsRepository.togglePin(postId, userId)
  },

  async sharePost(postId: string, userId: string, caption?: string, visibility?: string) {
    const post = await postsRepository.findById(postId)
    if (!post) throw new AppError('Bài viết không tồn tại', 404, 'POST_NOT_FOUND')
    return postsRepository.sharePost(postId, userId, uuidv4(), caption, visibility)
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
    const owner = await usersRepository.findById(userId)
    if (!owner || owner.status === 'BLOCKED') {
      throw new AppError('Nguoi dung khong ton tai', 404, 'USER_NOT_FOUND')
    }
    if (owner.profileVisibility === 'PRIVATE' && owner.userId !== viewerId) {
      const relation = await friendsRepository.getStatus(viewerId, owner.userId)
      if (relation.status !== 'ACCEPTED') {
        return { posts: [], meta: paginationMeta(page, limit, skip) }
      }
    }
    const posts = await postsRepository.getUserPosts(userId, viewerId, skip, limit)
    const enriched = await enrichPostsWithOriginal(posts.map(sanitizePostMedia))
    return { posts: enriched, meta: paginationMeta(page, limit, posts.length + skip) }
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
