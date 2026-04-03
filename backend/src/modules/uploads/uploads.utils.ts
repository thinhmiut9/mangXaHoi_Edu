import multer from 'multer'
import { cloudinaryV2 } from '../../config/cloudinary'
import { AppError } from '../../middleware/errorHandler'
import { Request } from 'express'
import { Readable } from 'stream'

// Use memory storage and stream directly to Cloudinary
const storage = multer.memoryStorage()

export const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new AppError('Ch? ch?p nh?n file ?nh (jpg, png, gif, webp)', 400))
    } else {
      cb(null, true)
    }
  },
})

export const uploadVideo = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new AppError('Ch? ch?p nh?n file video (mp4, webm, mov, mkv)', 400))
    } else {
      cb(null, true)
    }
  },
})

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinaryV2.uploader.upload_stream(
      { folder: `edusocial/${folder}`, public_id: publicId, resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'))
        else resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    const readable = new Readable()
    readable.push(buffer)
    readable.push(null)
    readable.pipe(stream)
  })
}

export async function uploadVideoToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinaryV2.uploader.upload_stream(
      { folder: `edusocial/${folder}`, public_id: publicId, resource_type: 'video' },
      (error, result) => {
        if (error || !result) reject(error ?? new Error('Upload failed'))
        else resolve({ url: result.secure_url, publicId: result.public_id })
      }
    )
    const readable = new Readable()
    readable.push(buffer)
    readable.push(null)
    readable.pipe(stream)
  })
}
