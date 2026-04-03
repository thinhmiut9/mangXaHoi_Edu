import { z } from 'zod'
import { isCloudinaryImageUrl } from '../../utils/cloudinary'

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(300).optional(),
  avatarUrl: z.string().url().refine(isCloudinaryImageUrl, 'Ảnh đại diện phải là ảnh Cloudinary').optional(),
  coverUrl: z.string().url().refine(isCloudinaryImageUrl, 'Ảnh bìa phải là ảnh Cloudinary').optional(),
  location: z.string().max(120).optional(),
  profileVisibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional(),
})

export const searchUsersSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const searchAllSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>
