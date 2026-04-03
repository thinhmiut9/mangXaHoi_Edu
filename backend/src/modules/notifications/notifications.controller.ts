import { Request, Response, NextFunction } from 'express'
import { notificationsService } from './notifications.service'
import { sendSuccess } from '../../utils/response'

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20' } = req.query as Record<string, string>
      const notifications = await notificationsService.getNotifications(req.user!.userId, +page, +limit)
      sendSuccess(res, notifications)
    } catch (err) {
      next(err)
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markRead(String(req.params.id), req.user!.userId)
      sendSuccess(res, null)
    } catch (err) {
      next(err)
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.markAllRead(req.user!.userId)
      sendSuccess(res, null, 'Đã đánh dấu tất cả đã đọc')
    } catch (err) {
      next(err)
    }
  },

  async deleteById(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.deleteById(String(req.params.id), req.user!.userId)
      sendSuccess(res, null, 'Đã xóa thông báo')
    } catch (err) {
      next(err)
    }
  },

  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const count = await notificationsService.getUnreadCount(req.user!.userId)
      sendSuccess(res, { count })
    } catch (err) {
      next(err)
    }
  },

  async getUnreadSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await notificationsService.getUnreadSummary(req.user!.userId)
      sendSuccess(res, summary)
    } catch (err) {
      next(err)
    }
  },
}

