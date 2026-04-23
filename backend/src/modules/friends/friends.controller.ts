import { Request, Response, NextFunction } from 'express'
import { friendsService } from './friends.service'
import { sendSuccess } from '../../utils/response'

export const friendsController = {
  async getFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const friends = await friendsService.getFriends(req.user!.userId)
      sendSuccess(res, friends)
    } catch (err) { next(err) }
  },

  async getRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const requests = await friendsService.getRequests(req.user!.userId)
      sendSuccess(res, requests)
    } catch (err) { next(err) }
  },

  async getSentRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const requests = await friendsService.getSentRequests(req.user!.userId)
      sendSuccess(res, requests)
    } catch (err) { next(err) }
  },

  async getSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const suggestions = await friendsService.getSuggestions(req.user!.userId)
      sendSuccess(res, suggestions)
    } catch (err) { next(err) }
  },

  async getBlockedUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await friendsService.getBlockedUsers(req.user!.userId)
      sendSuccess(res, users)
    } catch (err) { next(err) }
  },

  async sendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await friendsService.sendRequest(req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã gửi lời mời kết bạn')
    } catch (err) { next(err) }
  },

  async blockUser(req: Request, res: Response, next: NextFunction) {
    try {
      await friendsService.blockUser(req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã chặn người dùng')
    } catch (err) { next(err) }
  },

  async unblockUser(req: Request, res: Response, next: NextFunction) {
    try {
      await friendsService.unblockUser(req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã bỏ chặn người dùng')
    } catch (err) { next(err) }
  },

  async acceptRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await friendsService.acceptRequest(req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã chấp nhận lời mời')
    } catch (err) { next(err) }
  },

  async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await friendsService.rejectRequest(req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã từ chối lời mời')
    } catch (err) { next(err) }
  },

  async cancelRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await friendsService.cancelRequest(req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã thu hồi lời mời kết bạn')
    } catch (err) { next(err) }
  },

  async unfriend(req: Request, res: Response, next: NextFunction) {
    try {
      await friendsService.unfriend(req.user!.userId, String(req.params.userId))
      sendSuccess(res, null, 'Đã hủy kết bạn')
    } catch (err) { next(err) }
  },

  async getRequestCount(req: Request, res: Response, next: NextFunction) {
    try {
      const requests = await friendsService.getRequests(req.user!.userId)
      sendSuccess(res, { count: requests.length })
    } catch (err) { next(err) }
  },
}
