import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '../../utils/response'
import { storiesService } from './stories.service'

export const storiesController = {
  async createStory(req: Request, res: Response, next: NextFunction) {
    try {
      const story = await storiesService.createStory(req.user!.userId, req.body)
      sendSuccess(res, story, 'Đăng tin thành công', 201)
    } catch (err) { next(err) }
  },

  async getFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const stories = await storiesService.getFeed(req.user!.userId)
      sendSuccess(res, stories, 'Lấy danh sách tin thành công')
    } catch (err) { next(err) }
  },

  async getStory(req: Request, res: Response, next: NextFunction) {
    try {
      const story = await storiesService.getStory(String(req.params.id), req.user!.userId)
      sendSuccess(res, story)
    } catch (err) { next(err) }
  },

  async markViewed(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await storiesService.markViewed(String(req.params.id), req.user!.userId)
      sendSuccess(res, result)
    } catch (err) { next(err) }
  },

  async getViewers(req: Request, res: Response, next: NextFunction) {
    try {
      const viewers = await storiesService.getViewers(String(req.params.id), req.user!.userId)
      sendSuccess(res, viewers)
    } catch (err) { next(err) }
  },

  async deleteStory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await storiesService.deleteStory(String(req.params.id), req.user!.userId)
      sendSuccess(res, result, 'Xóa tin thành công')
    } catch (err) { next(err) }
  },
}
