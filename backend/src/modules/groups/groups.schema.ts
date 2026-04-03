import { z } from 'zod'

export const createGroupSchema = z.object({
  name: z.string().min(3, 'Tên nhóm tối thiểu 3 ký tự').max(100),
  description: z.string().max(500).optional().default(''),
  coverUrl: z.union([z.string().url(), z.literal('')]).optional().default(''),
  privacy: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
})

export const updateGroupSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  coverUrl: z.string().url().optional(),
  privacy: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
})

export type CreateGroupDto = z.infer<typeof createGroupSchema>
export type UpdateGroupDto = z.infer<typeof updateGroupSchema>
