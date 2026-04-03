import { Request, Response, NextFunction } from 'express'
import { adminService } from './admin.service'
import { sendSuccess } from '../../utils/response'

export const adminController = {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboard()
      sendSuccess(res, stats)
    } catch (err) {
      next(err)
    }
  },

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20', search } = req.query as Record<string, string>
      const result = await adminService.listUsers(+page, +limit, search)
      sendSuccess(res, result.users)
    } catch (err) {
      next(err)
    }
  },

  async getUserDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const detail = await adminService.getUserDetail(String(req.params.id))
      sendSuccess(res, detail)
    } catch (err) {
      next(err)
    }
  },

  async blockUser(req: Request, res: Response, next: NextFunction) {
    try {
      await adminService.blockUser(String(req.params.id), req.user?.userId)
      sendSuccess(res, null, 'Đã khóa tài khoản')
    } catch (err) {
      next(err)
    }
  },

  async unblockUser(req: Request, res: Response, next: NextFunction) {
    try {
      await adminService.unblockUser(String(req.params.id))
      sendSuccess(res, null, 'Đã mở khóa tài khoản')
    } catch (err) {
      next(err)
    }
  },
}

