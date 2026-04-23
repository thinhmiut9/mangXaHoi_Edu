import { z } from 'zod'

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const normalizeTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 30)
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 30)
  }
  return []
}

export const createDocumentSchema = z.object({
  title: z.preprocess(normalizeText, z.string().min(1).max(255)).optional(),
  subject: z.preprocess(normalizeText, z.string().max(160)).optional(),
  school: z.preprocess(normalizeText, z.string().max(160)).optional(),
  major: z.preprocess(normalizeText, z.string().max(160)).optional(),
  cohort: z.preprocess(normalizeText, z.string().max(80)).optional(),
  description: z.preprocess(normalizeText, z.string().max(1200)).optional(),
  tags: z.preprocess(normalizeTags, z.array(z.string().min(1).max(80))).optional(),
  visibility: z.enum(['PUBLIC', 'FRIENDS', 'PRIVATE']).optional().default('PUBLIC'),
})

export const listDocumentsQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  school: z.string().trim().max(160).optional().default(''),
  major: z.string().trim().max(160).optional().default(''),
  fileType: z.enum(['PDF', 'DOC', 'PPT']).optional(),
  timeRange: z.enum(['ALL', '7D', '30D', '90D']).optional().default('ALL'),
  sortBy: z.enum(['NEWEST', 'POPULAR', 'RATING']).optional().default('NEWEST'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>
export type ListDocumentsQueryDto = z.infer<typeof listDocumentsQuerySchema>

