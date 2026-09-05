import { Router } from 'express'
import { requireAuth } from '@/middleware/auth'
import { asyncHandler } from '@/lib/asyncHandler'
import * as controller from '@/controllers/account.controller'

const router = Router()

router.get('/provider',     requireAuth, asyncHandler(controller.getProvider))
router.put('/provider',     requireAuth, asyncHandler(controller.setProvider))
router.get('/agents',       requireAuth, asyncHandler(controller.listAgents))
router.post('/agents',      requireAuth, asyncHandler(controller.createAgent))
router.delete('/agents/:id', requireAuth, asyncHandler(controller.revokeAgent))

export default router
