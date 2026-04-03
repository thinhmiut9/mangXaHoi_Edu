import { Router } from 'express'
import { groupsController } from './groups.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { validate } from '../../middleware/validate'
import { createGroupSchema, updateGroupSchema } from './groups.schema'

const router = Router()
router.use(requireAuth)

router.get('/', groupsController.list)
router.get('/my', groupsController.getMyGroups)
router.post('/', validate(createGroupSchema), groupsController.createGroup)
router.get('/:id', groupsController.getGroup)
router.put('/:id', validate(updateGroupSchema), groupsController.updateGroup)
router.post('/:id/join', groupsController.join)
router.delete('/:id/leave', groupsController.leave)
router.get('/:id/members', groupsController.getMembers)
router.get('/:id/requests', groupsController.getJoinRequests)
router.put('/:id/requests/:userId/approve', groupsController.approveJoinRequest)
router.delete('/:id/requests/:userId/reject', groupsController.rejectJoinRequest)

export default router
