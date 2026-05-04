import { Request, Response, NextFunction } from 'express'
import { adminService } from './admin.service'
import { sendSuccess } from '../../utils/response'
import { AppError } from '../../middleware/errorHandler'

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

  async listDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const { status = 'ALL', page = '1', limit = '20' } = req.query as Record<string, string>
      const normalizedStatus = ['ALL', 'PENDING', 'ACTIVE', 'REJECTED'].includes(status)
        ? (status as 'ALL' | 'PENDING' | 'ACTIVE' | 'REJECTED')
        : 'ALL'
      const result = await adminService.listDocuments(normalizedStatus, Number(page), Number(limit))
      sendSuccess(res, result.documents)
    } catch (err) {
      next(err)
    }
  },

  async getDocumentDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const detail = await adminService.getDocumentDetail(String(req.params.id))
      sendSuccess(res, detail)
    } catch (err) {
      next(err)
    }
  },

  async getDocumentAccessUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const download = String(req.query.download || '') === '1'
      const result = await adminService.getDocumentAccessUrl(String(req.params.id), download)
      sendSuccess(res, { url: result.url }, 'Lay lien ket tai lieu thanh cong')
    } catch (err) {
      next(err)
    }
  },

  async reviewDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const status = String(req.body?.status || '').toUpperCase()
      if (status !== 'ACTIVE' && status !== 'REJECTED') {
        throw new AppError('Trang thai kiem duyet khong hop le', 400, 'INVALID_STATUS')
      }
      const updated = await adminService.reviewDocument(
        String(req.params.id),
        {
          status,
          moderationNote: typeof req.body?.moderationNote === 'string' ? req.body.moderationNote : undefined,
        },
        req.user!.userId
      )
      sendSuccess(res, updated, 'Cap nhat kiem duyet tai lieu thanh cong')
    } catch (err) {
      next(err)
    }
  },

  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      await adminService.deleteDocument(String(req.params.id))
      sendSuccess(res, null, 'Xoa tai lieu thanh cong')
    } catch (err) {
      next(err)
    }
  },
}
