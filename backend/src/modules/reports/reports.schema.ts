import { z } from 'zod'

export const createReportSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(['POST', 'COMMENT', 'USER', 'GROUP', 'DOCUMENT']),
  reason: z.enum(['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'FAKE_NEWS', 'ABUSE', 'OTHER']),
  description: z.string().max(1000).optional(),
})

export const updateReportSchema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  action: z.enum(['MARK_ONLY', 'HIDE_CONTENT', 'LOCK_24H', 'LOCK_7D']).optional(),
  note: z.string().max(1000).optional(),
  notifyReporter: z.boolean().optional(),
})

export type CreateReportDto = z.infer<typeof createReportSchema>
