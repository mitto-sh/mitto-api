import { Router, Response } from 'express'
import { z } from 'zod'
import { db, environmentVariables, eq, and, sql } from '../lib/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { encrypt, decrypt } from '../lib/crypto'
import { param, requireQueryParam } from '../lib/params'
import { asyncHandler } from '../lib/asyncHandler'
import { assertServiceOwner } from '../lib/ownership'

const router = Router()

const upsertEnvVarSchema = z.object({
  environmentId: z.string().uuid(),
  vars: z.array(z.object({
    key:      z.string().min(1).regex(/^[A-Z_][A-Z0-9_]*$/, 'Key must be uppercase with underscores'),
    value:    z.string(),
    isSecret: z.boolean().default(true),
  })).min(1),
})

router.get('/:serviceId', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const serviceId = param(req.params.serviceId)
  const environmentId = requireQueryParam(req.query, 'environmentId')

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
  const environmentId = requireQueryParam(req.query, 'environmentId')

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
