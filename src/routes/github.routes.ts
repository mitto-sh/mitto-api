import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../lib/asyncHandler'
import * as controller from '../controllers/github.controller'

const router = Router()

router.get('/install-url', requireAuth, controller.getInstallUrl)
router.get('/app/callback', asyncHandler(controller.installCallback))
router.get('/installations', requireAuth, asyncHandler(controller.listInstallations))
router.get('/installations/:id/repos', requireAuth, asyncHandler(controller.listRepos))
router.get('/installations/:id/repos/:owner/:repo/config', requireAuth, asyncHandler(controller.getRepoConfig))

export default router
