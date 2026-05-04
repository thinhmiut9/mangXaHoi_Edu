import { Request, Response, NextFunction } from 'express'
import { groupsService } from './groups.service'
import { sendSuccess } from '../../utils/response'

export const groupsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await groupsService.list(req.user!.userId)
      sendSuccess(res, groups)
    } catch (err) { next(err) }
  },

  async getMyGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const groups = await groupsService.getMyGroups(req.user!.userId)
      sendSuccess(res, groups)
    } catch (err) { next(err) }
  },

  async getGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await groupsService.getGroup(String(req.params.id), req.user?.userId)
      sendSuccess(res, group)
    } catch (err) { next(err) }
  },

  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await groupsService.createGroup(req.user!.userId, req.body)
      sendSuccess(res, group, 'Tạo nhóm thành công', 201)
    } catch (err) { next(err) }
  },

  async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await groupsService.updateGroup(String(req.params.id), req.user!.userId, req.body)
      sendSuccess(res, group, 'Cập nhật nhóm thành công')
    } catch (err) { next(err) }
  },

  async join(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await groupsService.joinGroup(String(req.params.id), req.user!.userId)
      const message = result.status === 'REQUESTED'
        ? 'Đã gửi yêu cầu tham gia nhóm. Vui lòng chờ duyệt.'
        : 'Đã tham gia nhóm'
      sendSuccess(res, result, message)
    } catch (err) { next(err) }
  },

  async leave(req: Request, res: Response, next: NextFunction) {
    try {
      await groupsService.leaveGroup(String(req.params.id), req.user!.userId)
      sendSuccess(res, null, 'Đã rời nhóm')
    } catch (err) { next(err) }
  },

  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await groupsService.getMembers(String(req.params.id))
      sendSuccess(res, members)
    } catch (err) { next(err) }
  },

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      await groupsService.removeMember(String(req.params.id), req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã xóa thành viên khỏi nhóm')
    } catch (err) { next(err) }
  },

  async assignRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { role } = req.body
      if (!role) {
        res.status(400).json({ success: false, message: 'Thiếu thông tin quyền' })
        return
      }
      await groupsService.assignRole(String(req.params.id), req.user!.userId, String(req.params.userId), role)
      sendSuccess(res, null, 'Đã cập nhật quyền thành viên')
    } catch (err) { next(err) }
  },

  async getJoinRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const requests = await groupsService.getJoinRequests(String(req.params.id), req.user!.userId)
      sendSuccess(res, requests)
    } catch (err) { next(err) }
  },

  async approveJoinRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await groupsService.approveJoinRequest(String(req.params.id), req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã duyệt yêu cầu tham gia')
    } catch (err) { next(err) }
  },

  async rejectJoinRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await groupsService.rejectJoinRequest(String(req.params.id), req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã từ chối yêu cầu tham gia')
    } catch (err) { next(err) }
  },
}
