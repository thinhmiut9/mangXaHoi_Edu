import { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { sendSuccess } from '../../utils/response'

export const authController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body)
      sendSuccess(res, result, 'Đăng ký thành công', 201)
    } catch (err) { next(err) }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body)
      sendSuccess(res, result, 'Đăng nhập thành công')
    } catch (err) { next(err) }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user!.userId)
      sendSuccess(res, user, 'Lấy thông tin thành công')
    } catch (err) { next(err) }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body)
      sendSuccess(res, null, 'Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu')
    } catch (err) { next(err) }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPassword(req.body)
      sendSuccess(res, null, 'Đặt lại mật khẩu thành công')
    } catch (err) { next(err) }
  },

  logout(_req: Request, res: Response) {
    // JWT is stateless — client should discard the token
    sendSuccess(res, null, 'Đăng xuất thành công')
  },
}
