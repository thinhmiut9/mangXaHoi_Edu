import { Request, Response, NextFunction } from 'express'
import { postsService } from './posts.service'
import { sendSuccess } from '../../utils/response'

export const postsController = {
  async getFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10' } = req.query as Record<string, string>
      const result = await postsService.getFeed(req.user!.userId, +page, +limit)
      sendSuccess(res, result.posts, 'Tải bảng tin thành công', 200, result.meta)
    } catch (err) { next(err) }
  },

  async createPost(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await postsService.createPost(req.user!.userId, req.body)
      sendSuccess(res, post, 'Đăng bài thành công', 201)
    } catch (err) { next(err) }
  },

  async getPost(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await postsService.getPost(String(req.params.id), req.user?.userId)
      sendSuccess(res, post)
    } catch (err) { next(err) }
  },

  async updatePost(req: Request, res: Response, next: NextFunction) {
    try {
      const post = await postsService.updatePost(String(req.params.id), req.user!.userId, req.body)
      sendSuccess(res, post, 'Cập nhật thành công')
    } catch (err) { next(err) }
  },

  async deletePost(req: Request, res: Response, next: NextFunction) {
    try {
      await postsService.deletePost(String(req.params.id), req.user!.userId, req.user!.role)
      sendSuccess(res, null, 'Xóa bài viết thành công')
    } catch (err) { next(err) }
  },

  async toggleLike(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await postsService.toggleLike(String(req.params.id), req.user!.userId)
      sendSuccess(res, result)
    } catch (err) { next(err) }
  },

  async toggleSave(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await postsService.toggleSave(String(req.params.id), req.user!.userId)
      sendSuccess(res, result)
    } catch (err) { next(err) }
  },

  async togglePin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await postsService.togglePin(String(req.params.id), req.user!.userId)
      sendSuccess(res, result)
    } catch (err) { next(err) }
  },

  async sharePost(req: Request, res: Response, next: NextFunction) {
    try {
      const { caption, visibility } = req.body ?? {}
      const result = await postsService.sharePost(String(req.params.id), req.user!.userId, caption, visibility)
      sendSuccess(res, result)
    } catch (err) { next(err) }
  },

  async getReactions(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await postsService.getReactions(String(req.params.id))
      sendSuccess(res, users)
    } catch (err) { next(err) }
  },

  async getSavedPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10' } = req.query as Record<string, string>
      const result = await postsService.getSavedPosts(req.user!.userId, +page, +limit)
      sendSuccess(res, result.posts, 'Lấy bài đã lưu thành công', 200, result.meta)
    } catch (err) { next(err) }
  },

  async getUserPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10' } = req.query as Record<string, string>
      const result = await postsService.getUserPosts(String(req.params.userId), req.user!.userId, +page, +limit)
      sendSuccess(res, result.posts, 'Lấy bài viết thành công', 200, result.meta)
    } catch (err) { next(err) }
  },

  async getGroupPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10' } = req.query as Record<string, string>
      const result = await postsService.getGroupPosts(String(req.params.groupId), req.user!.userId, +page, +limit)
      sendSuccess(res, result.posts, 'Lấy bài thảo luận nhóm thành công', 200, result.meta)
    } catch (err) { next(err) }
  },
}
