import { Request, Response, NextFunction } from 'express'
import { reportsService } from './reports.service'
import { sendSuccess } from '../../utils/response'

export const reportsController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await reportsService.createReport(req.user!.userId, req.body)
      sendSuccess(res, report, 'Báo cáo đã được gửi', 201)
    } catch (err) { next(err) }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, page = '1', limit = '20' } = req.query as Record<string, string>
      const result = await reportsService.listReports(status, +page, +limit)
      sendSuccess(res, result.reports, 'OK')
    } catch (err) { next(err) }
  },

  async detail(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await reportsService.getReportDetail(String(req.params.id))
      sendSuccess(res, report, 'OK')
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      await reportsService.updateStatus(
        String(req.params.id),
        {
          status: req.body.status,
          action: req.body.action,
          note: req.body.note,
          notifyReporter: req.body.notifyReporter,
        },
        req.user!.userId
      )
      sendSuccess(res, null, 'Đã cập nhật báo cáo')
    } catch (err) { next(err) }
  },
}
