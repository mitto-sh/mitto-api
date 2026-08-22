import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../lib/asyncHandler'
import * as controller from '../controllers/auth.controller'

const router = Router()

router.get('/github',          controller.redirectToGithub)
router.get('/github/callback', asyncHandler(controller.githubCallback))
router.get('/me', requireAuth, asyncHandler(controller.me))

export default router
