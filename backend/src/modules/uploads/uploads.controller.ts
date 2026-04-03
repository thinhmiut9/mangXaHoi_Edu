import { Request, Response, NextFunction } from 'express'
import { uploadImage, uploadToCloudinary, uploadVideo, uploadVideoToCloudinary } from './uploads.utils'
import { sendSuccess } from '../../utils/response'
import { AppError } from '../../middleware/errorHandler'

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
}
