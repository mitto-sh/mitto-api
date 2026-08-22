import { Router, Response } from 'express'
import { z } from 'zod'
import { db, environments, projects, eq, and, asc, desc, ne, sql } from '../lib/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/error'
import { param } from '../lib/params'
import { asyncHandler } from '../lib/asyncHandler'

const router = Router()

const createEnvironmentSchema = z.object({
  projectId: z.string().uuid(),
  name:      z.string().min(1).max(64),
})

const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(64),
})

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function assertProjectOwner(projectId: string, userId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!project) throw new AppError(404, 'Project not found')
  if (project.ownerId !== userId) throw new AppError(403, 'Forbidden')
  return project
}

async function assertSlugAvailable(projectId: string, slug: string, excludeEnvironmentId?: string) {
  const existing = await db
    .select({ id: environments.id })
    .from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.slug, slug)))
    .limit(1)

  if (existing.length > 0 && existing[0]!.id !== excludeEnvironmentId) {
    throw new AppError(409, `Environment with slug "${slug}" already exists in this project`)
  }
}

router.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query

  if (!projectId || typeof projectId !== 'string') {
    throw new AppError(400, 'projectId query param is required')
  }

  await assertProjectOwner(projectId, req.user!.id)

  const rows = await db
    .select()
    .from(environments)
    .where(eq(environments.projectId, projectId))
    .orderBy(desc(environments.isDefault), asc(environments.createdAt))

  res.json(rows)
}))

router.post('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createEnvironmentSchema.parse(req.body)
  await assertProjectOwner(body.projectId, req.user!.id)

  const slug = slugify(body.name)
  await assertSlugAvailable(body.projectId, slug)

  const [environment] = await db
    .insert(environments)
    .values({ projectId: body.projectId, name: body.name, slug, isDefault: false })
    .returning()

  res.status(201).json(environment)
}))

router.patch('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = param(req.params.id)
  const body = updateEnvironmentSchema.parse(req.body)

  const [environment] = await db.select().from(environments).where(eq(environments.id, id)).limit(1)
  if (!environment) throw new AppError(404, 'Environment not found')
  await assertProjectOwner(environment.projectId, req.user!.id)

  const slug = slugify(body.name)
  await assertSlugAvailable(environment.projectId, slug, environment.id)

  const [updated] = await db
    .update(environments)
    .set({ name: body.name, slug })
    .where(eq(environments.id, id))
    .returning()

  res.json(updated)
}))

router.delete('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = param(req.params.id)

  const [environment] = await db.select().from(environments).where(eq(environments.id, id)).limit(1)
  if (!environment) throw new AppError(404, 'Environment not found')
  await assertProjectOwner(environment.projectId, req.user!.id)

  if (environment.isDefault) {
    throw new AppError(409, 'The default environment cannot be deleted')
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(environments)
    .where(and(eq(environments.projectId, environment.projectId), ne(environments.id, id)))

  if (count === 0) {
    throw new AppError(409, 'A project must have at least one environment')
  }

  await db.delete(environments).where(eq(environments.id, id))

  res.status(204).send()
}))

export default router
