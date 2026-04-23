import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth'
import { validate } from '../../middleware/validate'
import { createStorySchema } from './stories.schema'
import { storiesController } from './stories.controller'

const router = Router()

router.use(requireAuth)

router.get('/', storiesController.getFeed)
router.post('/', validate(createStorySchema), storiesController.createStory)
router.get('/:id', storiesController.getStory)
router.post('/:id/view', storiesController.markViewed)
router.get('/:id/viewers', storiesController.getViewers)
router.delete('/:id', storiesController.deleteStory)

export default router
