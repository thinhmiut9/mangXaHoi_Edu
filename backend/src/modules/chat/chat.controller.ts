import { Request, Response, NextFunction } from 'express'
import { chatService } from './chat.service'
import { sendSuccess } from '../../utils/response'

export const chatController = {
  async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const conversations = await chatService.getConversations(req.user!.userId)
      sendSuccess(res, conversations)
    } catch (err) { next(err) }
  },
  async getOrCreateConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await chatService.getOrCreateDirectConversation(req.user!.userId, req.body.targetId)
      sendSuccess(res, conversation, 'OK', 200)
    } catch (err) { next(err) }
  },
  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1' } = req.query as Record<string, string>
      const messages = await chatService.getMessages(String(req.params.id), req.user!.userId, +page)
      sendSuccess(res, messages)
    } catch (err) { next(err) }
  },
  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { content, type, mediaUrl, fileName, fileSize, mimeType, thumbnailUrl } = req.body
      const message = await chatService.sendMessage(
        String(req.params.id),
        req.user!.userId,
        content,
        type && type !== 'TEXT' ? { type, mediaUrl, fileName, fileSize, mimeType, thumbnailUrl } : undefined
      )
      sendSuccess(res, message, 'Gửi tin nhắn thành công', 201)
    } catch (err) { next(err) }
  },
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      await chatService.markAsRead(String(req.params.id), req.user!.userId)
      sendSuccess(res, null)
    } catch (err) { next(err) }
  },

  async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      await chatService.deleteConversation(String(req.params.id), req.user!.userId)
      sendSuccess(res, null, 'Da xoa cuoc tro chuyen phia ban')
    } catch (err) { next(err) }
  },

  async getMediaMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const messages = await chatService.getMediaMessages(String(req.params.id), req.user!.userId)
      sendSuccess(res, messages)
    } catch (err) { next(err) }
  },

  async acceptMessageRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await chatService.acceptMessageRequest(String(req.params.id), req.user!.userId)
      sendSuccess(res, null, 'Da chap nhan tin nhan')
    } catch (err) { next(err) }
  },

  async getConversationMeta(req: Request, res: Response, next: NextFunction) {
    try {
      const meta = await chatService.getConversationMeta(String(req.params.id), req.user!.userId)
      sendSuccess(res, meta)
    } catch (err) { next(err) }
  },

  async createGroupConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, participantIds, avatarUrl } = req.body as { name: string; participantIds: string[]; avatarUrl?: string }
      const conversation = await chatService.createGroupConversation(req.user!.userId, name, participantIds, avatarUrl)
      sendSuccess(res, conversation, 'Tạo nhóm thành công', 201)
    } catch (err) { next(err) }
  },

  async getGroupInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const info = await chatService.getGroupInfo(String(req.params.id), req.user!.userId)
      sendSuccess(res, info)
    } catch (err) { next(err) }
  },

  async updateGroupInfo(req: Request, res: Response, next: NextFunction) {
    try {
      await chatService.updateGroupInfo(String(req.params.id), req.user!.userId, req.body)
      sendSuccess(res, null, 'Đã cập nhật thông tin nhóm')
    } catch (err) { next(err) }
  },
}

