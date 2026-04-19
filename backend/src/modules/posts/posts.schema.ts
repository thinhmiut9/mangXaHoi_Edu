import { z } from 'zod'
import { isCloudinaryMediaUrl } from '../../utils/cloudinary'

const cloudinaryUrlSchema = z
  .string()
  .url('URL media không hợp lệ')
  .refine(isCloudinaryMediaUrl, 'Chỉ chấp nhận media đã tải lên Cloudinary')

export const createPostSchema = z.object({
  content: z.string().min(1, 'Nội dung không được trống').max(5000),
  imageUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  videoUrls: z.array(cloudinaryUrlSchema).max(4).optional(),
  documentUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  mediaUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'GROUP', 'PRIVATE']).default('PUBLIC'),
  groupId: z.string().optional(),
})

export const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  imageUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  videoUrls: z.array(cloudinaryUrlSchema).max(4).optional(),
  documentUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  mediaUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'GROUP', 'PRIVATE']).optional(),
})

export const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type CreatePostDto = z.infer<typeof createPostSchema>
export type UpdatePostDto = z.infer<typeof updatePostSchema>
