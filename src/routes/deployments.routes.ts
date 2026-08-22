import { Router } from 'express'
import { requireAuth } from '@/middleware/auth'
import { asyncHandler } from '@/lib/asyncHandler'
import * as controller from '@/controllers/deployments.controller'

const router = Router()

router.get('/',            requireAuth, asyncHandler(controller.list))
router.post('/',           requireAuth, asyncHandler(controller.trigger))
router.get('/:id',         requireAuth, asyncHandler(controller.get))
router.post('/:id/cancel', requireAuth, asyncHandler(controller.cancel))

export default router
