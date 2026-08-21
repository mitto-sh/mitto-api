import { Router, Response } from 'express'
import { z } from 'zod'
import { db } from '../db'
import { deployments, services, projects } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/error'
import { deployQueue } from '../queues/deploy'
import { param } from '../lib/params'
import { asyncHandler } from '../lib/asyncHandler'

const router = Router()

const triggerDeploySchema = z.object({
  serviceId:     z.string().uuid(),
  environmentId: z.string().uuid(),
  commitSha:     z.string().optional(),
  commitMessage: z.string().optional(),
})

router.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { serviceId, environmentId } = req.query

  if (!serviceId || typeof serviceId !== 'string') {
    throw new AppError(400, 'serviceId query param is required')
  }

  const rows = await db
    .select()
    .from(deployments)
    .where(
      environmentId && typeof environmentId === 'string'
        ? and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId))
        : eq(deployments.serviceId, serviceId),
    )
    .orderBy(desc(deployments.createdAt))
    .limit(20)

  res.json(rows)
}))

router.post('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = triggerDeploySchema.parse(req.body)

  const [service] = await db
    .select()
    .from(services)
    .where(eq(services.id, body.serviceId))
    .limit(1)

  if (!service) throw new AppError(404, 'Service not found')
  if (!service.enabled) throw new AppError(423, 'Service is disabled — enable it before deploying')

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, service.projectId))
    .limit(1)

  if (project?.ownerId !== req.user!.id) throw new AppError(403, 'Forbidden')
  if (!project.enabled) throw new AppError(423, 'Project is disabled — enable it before deploying')

  const [deployment] = await db
    .insert(deployments)
    .values({
      serviceId:     body.serviceId,
      environmentId: body.environmentId,
      status:        'queued',
      commitSha:     body.commitSha,
      commitMessage: body.commitMessage,
      triggeredBy:   req.user!.id,
    })
    .returning()

  await deployQueue.add('deploy', {
    deploymentId:  deployment.id,
    serviceId:     service.id,
    projectId:     project.id,
    environmentId: body.environmentId,
  })

  res.status(202).json(deployment)
}))

router.get('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, param(req.params.id)))
    .limit(1)

  if (!deployment) throw new AppError(404, 'Deployment not found')

  res.json(deployment)
}))

router.post('/:id/cancel', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [deployment] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, param(req.params.id)))
    .limit(1)

  if (!deployment) throw new AppError(404, 'Deployment not found')

  const cancellable = ['queued', 'building', 'pushing', 'provisioning']
  if (!cancellable.includes(deployment.status)) {
    throw new AppError(400, `Cannot cancel a deployment with status: ${deployment.status}`)
  }

  const [updated] = await db
    .update(deployments)
    .set({ status: 'cancelled', finishedAt: new Date() })
    .where(eq(deployments.id, deployment.id))
    .returning()

  res.json(updated)
}))

export default router
