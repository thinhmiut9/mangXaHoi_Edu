import { Router } from 'express'
import { friendsController } from './friends.controller'
import { requireAuth } from '../../middleware/requireAuth'

const router = Router()
router.use(requireAuth)

router.get('/', friendsController.getFriends)
router.get('/requests', friendsController.getRequests)
router.get('/requests/sent', friendsController.getSentRequests)
router.get('/suggestions', friendsController.getSuggestions)
router.post('/request/:userId', friendsController.sendRequest)
router.delete('/request/:userId', friendsController.cancelRequest)
router.put('/accept/:userId', friendsController.acceptRequest)
router.delete('/reject/:userId', friendsController.rejectRequest)
router.delete('/:userId', friendsController.unfriend)

export default router
