import { v4 as uuidv4 } from 'uuid'
import { storiesRepository } from './stories.repository'
import { AppError } from '../../middleware/errorHandler'
import { CreateStoryDto } from './stories.schema'

export const storiesService = {
  async createStory(userId: string, dto: CreateStoryDto) {
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)

    return storiesRepository.create({
      storyId: uuidv4(),
      type: dto.type,
      mediaUrl: dto.mediaUrl,
      content: dto.content,
      userId,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
  },

  async getFeed(viewerId: string) {
    const now = new Date().toISOString()
    await storiesRepository.deactivateExpired(now)
    return storiesRepository.getFeed(viewerId, now)
  },

  async getStory(storyId: string, viewerId: string) {
    const now = new Date().toISOString()
    await storiesRepository.deactivateExpired(now)
    const story = await storiesRepository.findVisibleById(storyId, viewerId, now)
    if (!story) throw new AppError('Tin không tồn tại hoặc đã hết hạn', 404, 'STORY_NOT_FOUND')
    return story
  },

  async markViewed(storyId: string, viewerId: string) {
    const story = await this.getStory(storyId, viewerId)
    if (story.author.userId === viewerId) {
      return { viewed: false, storyId: story.storyId }
    }
    await storiesRepository.markViewed(storyId, viewerId, new Date().toISOString())
    return { viewed: true, storyId: story.storyId }
  },

  async getViewers(storyId: string, requesterId: string) {
    const story = await this.getStory(storyId, requesterId)
    if (story.author.userId !== requesterId) {
      throw new AppError('Ban khong co quyen xem danh sach nguoi da xem tin nay', 403, 'FORBIDDEN')
    }
    return storiesRepository.getViewers(storyId)
  },
}
