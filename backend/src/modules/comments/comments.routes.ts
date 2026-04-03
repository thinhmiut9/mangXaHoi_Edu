import { Router } from 'express'
import { commentsController } from './comments.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { validate } from '../../middleware/validate'
import { createCommentSchema, updateCommentSchema } from './comments.schema'

const router = Router()
router.use(requireAuth)

router.get('/:postId', commentsController.getComments)
router.post('/:postId', validate(createCommentSchema), commentsController.createComment)
router.put('/:id', validate(updateCommentSchema), commentsController.updateComment)
router.delete('/:id', commentsController.deleteComment)
router.post('/:id/like', commentsController.toggleLike)

export default router
