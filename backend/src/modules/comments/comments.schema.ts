import { z } from 'zod'

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Nội dung không được trống').max(2000),
  parentId: z.string().optional(),
})

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
})

export type CreateCommentDto = z.infer<typeof createCommentSchema>
