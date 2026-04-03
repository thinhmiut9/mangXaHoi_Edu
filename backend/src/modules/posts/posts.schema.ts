import { z } from 'zod'
import { isCloudinaryImageUrl } from '../../utils/cloudinary'

const cloudinaryUrlSchema = z
  .string()
  .url('URL ảnh không hợp lệ')
  .refine(isCloudinaryImageUrl, 'Chỉ chấp nhận ảnh đã tải lên Cloudinary')

export const createPostSchema = z.object({
  content: z.string().min(1, 'Nội dung không được trống').max(5000),
  mediaUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'GROUP', 'PRIVATE']).default('PUBLIC'),
  groupId: z.string().optional(),
})

export const updatePostSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  mediaUrls: z.array(cloudinaryUrlSchema).max(10).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'GROUP', 'PRIVATE']).optional(),
})

export const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export type CreatePostDto = z.infer<typeof createPostSchema>
export type UpdatePostDto = z.infer<typeof updatePostSchema>
