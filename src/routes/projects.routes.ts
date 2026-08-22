import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { asyncHandler } from '../lib/asyncHandler'
import * as controller from '../controllers/projects.controller'

const router = Router()

router.get('/',       requireAuth, asyncHandler(controller.list))
router.post('/',      requireAuth, asyncHandler(controller.create))
router.get('/:id',    requireAuth, asyncHandler(controller.get))
router.patch('/:id',  requireAuth, asyncHandler(controller.update))
router.delete('/:id', requireAuth, asyncHandler(controller.remove))

export default router
