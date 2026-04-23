import { Router } from 'express'
import { chatController } from './chat.controller'
import { requireAuth } from '../../middleware/requireAuth'

const router = Router()
router.use(requireAuth)

router.get('/conversations', chatController.getConversations)
router.post('/conversations', chatController.getOrCreateConversation)
router.post('/conversations/group', chatController.createGroupConversation)
router.get('/conversations/:id/messages', chatController.getMessages)
router.post('/conversations/:id/messages', chatController.sendMessage)
router.put('/conversations/:id/read', chatController.markAsRead)
router.put('/conversations/:id/accept', chatController.acceptMessageRequest)
router.get('/conversations/:id/meta', chatController.getConversationMeta)
router.get('/conversations/:id/group-info', chatController.getGroupInfo)
router.put('/conversations/:id/group-info', chatController.updateGroupInfo)
router.get('/conversations/:id/media', chatController.getMediaMessages)
router.delete('/conversations/:id', chatController.deleteConversation)

export default router
