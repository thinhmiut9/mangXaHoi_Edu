import { Router } from 'express'
import { postsController } from './posts.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { validate } from '../../middleware/validate'
import { createPostSchema, updatePostSchema, feedQuerySchema } from './posts.schema'

const router = Router()

router.use(requireAuth)

router.get('/', validate(feedQuerySchema, 'query'), postsController.getFeed)
router.post('/', validate(createPostSchema), postsController.createPost)
router.get('/saved', postsController.getSavedPosts)
router.get('/user/:userId', postsController.getUserPosts)
router.get('/group/:groupId', validate(feedQuerySchema, 'query'), postsController.getGroupPosts)
router.get('/:id', postsController.getPost)
router.put('/:id', validate(updatePostSchema), postsController.updatePost)
router.delete('/:id', postsController.deletePost)
router.post('/:id/like', postsController.toggleLike)
router.post('/:id/save', postsController.toggleSave)
router.post('/:id/pin', postsController.togglePin)
router.post('/:id/share', postsController.sharePost)
router.get('/:id/reactions', postsController.getReactions)

export default router
