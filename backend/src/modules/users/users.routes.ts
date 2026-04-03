import { Router } from 'express'
import { usersController } from './users.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { validate } from '../../middleware/validate'
import { updateProfileSchema, searchUsersSchema, searchAllSchema } from './users.schema'

const router = Router()

router.get('/search', requireAuth, validate(searchUsersSchema, 'query'), usersController.searchUsers)
router.get('/search-all', requireAuth, validate(searchAllSchema, 'query'), usersController.searchAll)
router.get('/username/:username', requireAuth, usersController.getProfileByUsername)
router.get('/:id/friends', requireAuth, usersController.getUserFriends)
router.get('/:id', requireAuth, usersController.getProfile)
router.put('/me', requireAuth, validate(updateProfileSchema), usersController.updateProfile)

export default router
