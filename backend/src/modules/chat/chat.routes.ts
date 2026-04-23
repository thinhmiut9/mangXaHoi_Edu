import { Router } from 'express'
import { chatController } from './chat.controller'
import { requireAuth } from '../../middleware/requireAuth'

const router = Router()
router.use(requireAuth)

router.get('/conversations', chatController.getConversations)
router.post('/conversations', chatController.getOrCreateConversation)
router.get('/conversations/:id/messages', chatController.getMessages)
router.post('/conversations/:id/messages', chatController.sendMessage)
router.put('/conversations/:id/read', chatController.markAsRead)
router.put('/conversations/:id/accept', chatController.acceptMessageRequest)
router.get('/conversations/:id/meta', chatController.getConversationMeta)
router.delete('/conversations/:id', chatController.deleteConversation)

export default router
