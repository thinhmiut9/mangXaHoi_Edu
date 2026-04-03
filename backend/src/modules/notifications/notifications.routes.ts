import { Router } from 'express'
import { notificationsController } from './notifications.controller'
import { requireAuth } from '../../middleware/requireAuth'

const router = Router()
router.use(requireAuth)

router.get('/', notificationsController.list)
router.get('/unread-count', notificationsController.getUnreadCount)
router.get('/unread-summary', notificationsController.getUnreadSummary)
router.put('/:id/read', notificationsController.markRead)
router.put('/read-all', notificationsController.markAllRead)
router.delete('/:id', notificationsController.deleteById)

export default router
