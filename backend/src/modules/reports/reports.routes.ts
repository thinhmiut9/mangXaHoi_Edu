import { Router } from 'express'
import { reportsController } from './reports.controller'
import { requireAuth } from '../../middleware/requireAuth'
import { requireRole } from '../../middleware/requireRole'
import { validate } from '../../middleware/validate'
import { createReportSchema, updateReportSchema } from './reports.schema'

const router = Router()
router.use(requireAuth)

router.post('/', validate(createReportSchema), reportsController.create)
router.get('/', requireRole('ADMIN'), reportsController.list)
router.get('/:id', requireRole('ADMIN'), reportsController.detail)
router.put('/:id', requireRole('ADMIN'), validate(updateReportSchema), reportsController.update)

export default router
