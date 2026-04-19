import { Request, Response, NextFunction } from 'express'
import { uploadDocument, uploadImage, uploadRawToCloudinary, uploadToCloudinary, uploadVideo, uploadVideoToCloudinary } from './uploads.utils'
import { sendSuccess } from '../../utils/response'
import { AppError } from '../../middleware/errorHandler'
import path from 'path'

export const uploadsController = {
  uploadImage: [
    uploadImage.single('image'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) throw new AppError('Khong co file duoc tai len', 400)
        const result = await uploadToCloudinary(req.file.buffer, 'images')
        sendSuccess(res, result, 'Tai anh thanh cong', 201)
      } catch (err) { next(err) }
    },
  ],

  uploadVideo: [
    uploadVideo.single('video'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) throw new AppError('Khong co file duoc tai len', 400)
        const result = await uploadVideoToCloudinary(req.file.buffer, 'stories')
        sendSuccess(res, result, 'Tai video thanh cong', 201)
      } catch (err) { next(err) }
    },
  ],

  uploadAvatar: [
    uploadImage.single('avatar'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) throw new AppError('Khong co file duoc tai len', 400)
        const result = await uploadToCloudinary(req.file.buffer, 'avatars', `avatar_${req.user!.userId}`)
        sendSuccess(res, result, 'Tai avatar thanh cong', 201)
      } catch (err) { next(err) }
    },
  ],

  uploadDocument: [
    uploadDocument.single('document'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) throw new AppError('Khong co file duoc tai len', 400)
        const ext = (path.extname(req.file.originalname || '') || '').toLowerCase()
        const base = path
          .basename(req.file.originalname || 'document', ext)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 80) || 'document'
        const publicId = `${base}_${Date.now()}${ext}`
        const result = await uploadRawToCloudinary(req.file.buffer, 'documents', publicId, req.file.originalname)
        sendSuccess(res, result, 'Tai tai lieu thanh cong', 201)
      } catch (err) { next(err) }
    },
  ],
}
