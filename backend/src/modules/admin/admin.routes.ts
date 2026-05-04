import { Router } from 'express'
import { adminController } from './admin.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { requireRole } from '../../middleware/requireRole'

const router = Router()
router.use(requireAuth, requireRole('ADMIN'))

router.get('/dashboard', adminController.dashboard)
router.get('/users', adminController.listUsers)
router.get('/users/:id', adminController.getUserDetail)
router.put('/users/:id/block', adminController.blockUser)
router.put('/users/:id/unblock', adminController.unblockUser)
router.get('/documents', adminController.listDocuments)
router.get('/documents/:id', adminController.getDocumentDetail)
router.get('/documents/:id/access-url', adminController.getDocumentAccessUrl)
router.put('/documents/:id/review', adminController.reviewDocument)
router.delete('/documents/:id', adminController.deleteDocument)

export default router
