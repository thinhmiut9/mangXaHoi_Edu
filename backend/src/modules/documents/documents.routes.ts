import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth'
import { uploadLimiter } from '../../middleware/rateLimiter'
import { uploadDocument } from '../uploads/uploads.utils'
import { documentsController } from './documents.controller'

const router = Router()
router.use(requireAuth)

router.get('/', documentsController.list)
router.get('/saved', documentsController.getSaved)
router.get('/mine', documentsController.getMine)
router.post('/:documentId/view', documentsController.recordView)
router.post('/:documentId/download-track', documentsController.recordDownload)
router.post('/:documentId/save', documentsController.toggleSave)
router.get('/:documentId/access-url', documentsController.getAccessUrl)
router.get('/:documentId/file', documentsController.streamInline)
router.get('/:documentId/download', documentsController.download)
router.post('/', uploadLimiter, uploadDocument.single('document'), documentsController.create)

export default router
