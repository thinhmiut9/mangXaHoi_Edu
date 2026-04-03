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

export default router
