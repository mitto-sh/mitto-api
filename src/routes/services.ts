import { Router, Response } from 'express'
import { z } from 'zod'
import { db, services, eq } from '../lib/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/error'
import { param } from '../lib/params'
import { asyncHandler } from '../lib/asyncHandler'
import { assertProjectOwner } from '../lib/ownership'

const router = Router()

const createServiceSchema = z.object({
  projectId:      z.string().uuid(),
  name:           z.string().min(1).max(64),
  type:           z.enum(['web', 'worker', 'cron', 'static']),
  port:           z.number().int().positive().optional(),
  cpu:            z.number().int().positive().default(256),
  memory:         z.number().int().positive().default(512),
  minReplicas:    z.number().int().min(0).default(1),
  maxReplicas:    z.number().int().min(1).default(3),
  healthCheck:    z.string().default('/healthz'),
  dockerfilePath: z.string().default('Dockerfile'),
  repoUrl:        z.string().url().optional(),
  repoProvider:   z.enum(['github', 'gitlab', 'bitbucket']).optional(),
  defaultBranch:  z.string().default('main'),
  buildCommand:   z.string().optional(),
  startCommand:   z.string().optional(),
  outputDir:      z.string().optional(),
  runtime:        z.enum(['node', 'python', 'static', 'docker']).optional(),
})

const updateServiceSchema = z.object({
  enabled: z.boolean().optional(),
})

router.post('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createServiceSchema.parse(req.body)
  await assertProjectOwner(body.projectId, req.user!.id)

  const [service] = await db
    .insert(services)
    .values(body)
    .returning()

  res.status(201).json(service)
}))

router.get('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, param(req.params.id)))
    .limit(1)

  if (!service) throw new AppError(404, 'Service not found')
  await assertProjectOwner(service.projectId, req.user!.id)

  res.json(service)
}))

router.patch('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = param(req.params.id)
  const body = updateServiceSchema.parse(req.body)

  const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1)
  if (!service) throw new AppError(404, 'Service not found')
  await assertProjectOwner(service.projectId, req.user!.id)

  const [updated] = await db
    .update(services)
    .set(body)
    .where(eq(services.id, id))
    .returning()

  res.json(updated)
}))

router.delete('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, param(req.params.id)))
    .limit(1)

  if (!service) throw new AppError(404, 'Service not found')
  await assertProjectOwner(service.projectId, req.user!.id)

  await db.delete(services).where(eq(services.id, service.id))

  res.status(204).send()
}))

export default router
