import { Router } from 'express'
import { uploadsController } from './uploads.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { uploadLimiter } from '../../middleware/rateLimiter'

const router = Router()
router.use(requireAuth, uploadLimiter)

router.post('/image', uploadsController.uploadImage)
router.post('/video', uploadsController.uploadVideo)
router.post('/avatar', uploadsController.uploadAvatar)
router.post('/document', uploadsController.uploadDocument)

export default router
