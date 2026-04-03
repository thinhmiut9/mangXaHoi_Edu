import { Request, Response, NextFunction } from 'express'
import { usersService } from './users.service'
import { sendSuccess } from '../../utils/response'

export const usersController = {
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await usersService.getProfile(String(req.params.id), req.user?.userId)
      sendSuccess(res, profile)
    } catch (err) {
      next(err)
    }
  },

  async getProfileByUsername(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await usersService.getProfileByUsername(String(req.params.username), req.user?.userId)
      sendSuccess(res, profile)
    } catch (err) {
      next(err)
    }
  },

  async getUserFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const friends = await usersService.getUserFriends(String(req.params.id), req.user?.userId)
      sendSuccess(res, friends)
    } catch (err) {
      next(err)
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await usersService.updateProfile(req.user!.userId, req.body)
      sendSuccess(res, updated, 'Cập nhật thành công')
    } catch (err) {
      next(err)
    }
  },

  async searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, page, limit } = req.query as { q: string; page: string; limit: string }
      const result = await usersService.searchUsers(q, +page || 1, +limit || 10)
      sendSuccess(res, result.users, 'Tìm kiếm thành công', 200, result.meta)
    } catch (err) {
      next(err)
    }
  },

  async searchAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, limit } = req.query as { q: string; limit: string }
      const result = await usersService.searchAll(req.user!.userId, q, +limit || 12)
      sendSuccess(res, result, 'Tìm kiếm thành công')
    } catch (err) {
      next(err)
    }
  },
}

