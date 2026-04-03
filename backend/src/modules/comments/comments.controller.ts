import { Request, Response, NextFunction } from 'express'
import { commentsService } from './comments.service'
import { sendSuccess } from '../../utils/response'

export const commentsController = {
  async getComments(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>
      const comments = await commentsService.getComments(String(req.params.postId), req.user!.userId, +page, +limit)
      sendSuccess(res, comments)
    } catch (err) { next(err) }
  },

  async createComment(req: Request, res: Response, next: NextFunction) {
    try {
      const comment = await commentsService.createComment(String(req.params.postId), req.user!.userId, req.body)
      sendSuccess(res, comment, 'Bình luận thành công', 201)
    } catch (err) { next(err) }
  },

  async updateComment(req: Request, res: Response, next: NextFunction) {
    try {
      const comment = await commentsService.updateComment(String(req.params.id), req.user!.userId, req.body.content)
      sendSuccess(res, comment, 'Cập nhật bình luận thành công')
    } catch (err) { next(err) }
  },

  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      await commentsService.deleteComment(String(req.params.id), req.user!.userId, req.user!.role)
      sendSuccess(res, null, 'Xóa bình luận thành công')
    } catch (err) { next(err) }
  },

  async toggleLike(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await commentsService.toggleLike(String(req.params.id), req.user!.userId)
      sendSuccess(res, result)
    } catch (err) { next(err) }
  },
}

