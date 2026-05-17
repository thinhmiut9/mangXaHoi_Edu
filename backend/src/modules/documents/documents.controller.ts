import { NextFunction, Request, Response } from 'express'
import { sendSuccess } from '../../utils/response'
import { createDocumentSchema, listDocumentsQuerySchema } from './documents.schema'
import { documentsService } from './documents.service'
import { getRecommendationsForUser, isRecommendationCacheReady } from './documents.recommendations'

export const documentsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = await listDocumentsQuerySchema.parseAsync(req.query)
      const result = await documentsService.list(req.user!.userId, query)
      sendSuccess(res, result.documents, 'Lay danh sach tai lieu thanh cong', 200, result.meta)
    } catch (err) {
      next(err)
    }
  },

  async getFacets(req: Request, res: Response, next: NextFunction) {
    try {
      const facets = await documentsService.getFacets()
      sendSuccess(res, facets, 'Lay bo loc tai lieu thanh cong', 200)
    } catch (err) {
      next(err)
    }
  },

  async getSaved(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, Number(req.query.page || 1))
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)))
      const result = await documentsService.getSaved(req.user!.userId, page, limit)
      sendSuccess(res, result.documents, 'Lay tai lieu da luu thanh cong', 200, result.meta)
    } catch (err) {
      next(err)
    }
  },

  async getMine(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, Number(req.query.page || 1))
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)))
      const result = await documentsService.getMine(req.user!.userId, page, limit)
      sendSuccess(res, result.documents, 'Lay tai lieu da dang thanh cong', 200, result.meta)
    } catch (err) {
      next(err)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dto = await createDocumentSchema.parseAsync(req.body)
      const document = await documentsService.create(req.user!.userId, dto, req.file)
      sendSuccess(res, document, 'Dang tai lieu thanh cong', 201)
    } catch (err) {
      next(err)
    }
  },

  async streamInline(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = String(req.params.documentId || '')
      const result = await documentsService.fetchFileBuffer(req.user!.userId, documentId)
      const encodedName = encodeURIComponent(result.document.fileName)

      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`)
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.send(result.buffer)
    } catch (err) {
      next(err)
    }
  },

  async download(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = String(req.params.documentId || '')
      const result = await documentsService.fetchFileBuffer(req.user!.userId, documentId)
      const encodedName = encodeURIComponent(result.document.fileName)

      res.setHeader('Content-Type', result.contentType)
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.send(result.buffer)
    } catch (err) {
      next(err)
    }
  },

  async getAccessUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = String(req.params.documentId || '')
      const download = String(req.query.download || '') === '1'
      const result = await documentsService.getAccessUrl(req.user!.userId, documentId, download)
      sendSuccess(res, { url: result.url }, 'Lay lien ket tai lieu thanh cong', 200)
    } catch (err) {
      next(err)
    }
  },

  async recordView(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = String(req.params.documentId || '')
      const document = await documentsService.recordView(req.user!.userId, documentId)
      sendSuccess(res, document, 'Cap nhat luot xem thanh cong', 200)
    } catch (err) {
      next(err)
    }
  },

  async recordDownload(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = String(req.params.documentId || '')
      const document = await documentsService.recordDownload(req.user!.userId, documentId)
      sendSuccess(res, document, 'Cap nhat luot tai thanh cong', 200)
    } catch (err) {
      next(err)
    }
  },

  async toggleSave(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = String(req.params.documentId || '')
      const result = await documentsService.toggleSave(req.user!.userId, documentId)
      sendSuccess(res, result, 'Cap nhat luu tai lieu thanh cong', 200)
    } catch (err) {
      next(err)
    }
  },

  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId
      const limit = Math.min(20, Math.max(1, Number(req.query.limit || 20)))

      if (!isRecommendationCacheReady()) {
        return sendSuccess(res, [], 'Cache chua san sang', 200)
      }

      // Lấy nhiều hơn limit để bù vào các doc có thể không còn tồn tại trong Neo4j
      const entries = getRecommendationsForUser(userId, limit * 2)

      if (entries.length === 0) {
        return sendSuccess(res, [], 'Khong co goi y', 200)
      }

      // Fetch metadata đầy đủ từ Neo4j
      const documentIds = entries.map(e => e.documentId)
      const documents = await documentsService.getByIds(userId, documentIds)

      // Map rank và score theo documentId để sort lại sau Neo4j fetch
      const scoreMap = new Map(entries.map(e => [e.documentId, e.similarityScore]))
      const rankMap = new Map(entries.map(e => [e.documentId, e.rank]))

      // Gắn similarityScore, sort theo rank gốc từ CSV, lấy đúng limit
      const result = documents
        .map(doc => ({
          ...doc,
          similarityScore: scoreMap.get(doc.documentId) ?? 0,
        }))
        .sort((a, b) => (rankMap.get(a.documentId) ?? 999) - (rankMap.get(b.documentId) ?? 999))
        .slice(0, limit)

      return sendSuccess(res, result, 'Lay goi y tai lieu thanh cong', 200)
    } catch (err) {
      return next(err)
    }
  },
}
