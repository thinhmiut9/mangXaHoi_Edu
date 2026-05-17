import { z } from 'zod'
import { isCloudinaryImageUrl } from '../../utils/cloudinary'

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  interests: z.string().max(300).optional(),
  avatarUrl: z.union([
    z.string().url().refine(isCloudinaryImageUrl, 'Ảnh đại diện phải là ảnh Cloudinary'),
    z.literal(''),
  ]).optional().nullable(),
  coverUrl: z.union([
    z.string().url().refine(isCloudinaryImageUrl, 'Ảnh bìa phải là ảnh Cloudinary'),
    z.literal(''),
  ]).optional().nullable(),
  location: z.string().max(120).optional(),
  school: z.string().max(120).optional(),
  major: z.string().max(120).optional(),
  cohort: z.string().max(50).optional(),
  profileVisibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
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
