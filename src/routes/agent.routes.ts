import { Router } from 'express'
import { asyncHandler } from '@/lib/asyncHandler'
import * as controller from '@/controllers/agent.controller'

const router = Router()

router.post('/session', asyncHandler(controller.openSession))

export default router
