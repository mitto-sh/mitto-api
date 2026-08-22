import { Router, Response } from 'express'
import { z } from 'zod'
import { db, environmentVariables, services, projects, eq, and, sql } from '../lib/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/error'
import { encrypt, decrypt } from '../lib/crypto'
import { param } from '../lib/params'
import { asyncHandler } from '../lib/asyncHandler'

const router = Router()

const upsertEnvVarSchema = z.object({
  environmentId: z.string().uuid(),
  vars: z.array(z.object({
    key:      z.string().min(1).regex(/^[A-Z_][A-Z0-9_]*$/, 'Key must be uppercase with underscores'),
    value:    z.string(),
    isSecret: z.boolean().default(true),
  })).min(1),
})

async function assertServiceOwner(serviceId: string, userId: string) {
  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1)
  if (!service) throw new AppError(404, 'Service not found')

  const [project] = await db.select().from(projects).where(eq(projects.id, service.projectId)).limit(1)
  if (project?.ownerId !== userId) throw new AppError(403, 'Forbidden')

  return service
}

router.get('/:serviceId', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const serviceId = param(req.params.serviceId)
  const { environmentId } = req.query

  if (!environmentId || typeof environmentId !== 'string') {
    throw new AppError(400, 'environmentId query param is required')
  }

  await assertServiceOwner(serviceId, req.user!.id)

  const vars = await db
    .select()
    .from(environmentVariables)
    .where(
      and(
        eq(environmentVariables.serviceId, serviceId),
        eq(environmentVariables.environmentId, environmentId),
      ),
    )

  res.json(vars.map((v) => ({
    ...v,
    value: v.isSecret ? '***' : decrypt(v.value),
  })))
}))

router.put('/:serviceId', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const serviceId = param(req.params.serviceId)
  await assertServiceOwner(serviceId, req.user!.id)

  const { environmentId, vars } = upsertEnvVarSchema.parse(req.body)

  const rows = vars.map((v) => ({
    serviceId,
    environmentId,
    key:       v.key,
    value:     encrypt(v.value),
    isSecret:  v.isSecret,
  }))

  const upserted = await db
    .insert(environmentVariables)
    .values(rows)
    .onConflictDoUpdate({
      target: [environmentVariables.serviceId, environmentVariables.environmentId, environmentVariables.key],
      set: {
        value: sql`excluded.value`,
        isSecret: sql`excluded.is_secret`,
      },
    })
    .returning()

  res.json(upserted.map((v) => ({ ...v, value: '***' })))
}))

router.delete('/:serviceId/:key', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const serviceId = param(req.params.serviceId)
  const key = param(req.params.key)
  const { environmentId } = req.query

  if (!environmentId || typeof environmentId !== 'string') {
    throw new AppError(400, 'environmentId query param is required')
  }

  await assertServiceOwner(serviceId, req.user!.id)

  await db
    .delete(environmentVariables)
    .where(
      and(
        eq(environmentVariables.serviceId, serviceId),
        eq(environmentVariables.environmentId, environmentId),
        eq(environmentVariables.key, key),
      ),
    )

  res.status(204).send()
}))

export default router
