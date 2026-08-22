import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../lib/asyncHandler'
import * as controller from '../controllers/envVars.controller'

const router = Router()

router.get('/:serviceId',        requireAuth, asyncHandler(controller.list))
router.put('/:serviceId',        requireAuth, asyncHandler(controller.upsert))
router.delete('/:serviceId/:key', requireAuth, asyncHandler(controller.remove))

export default router
