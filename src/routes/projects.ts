import { Router, Response } from 'express'
import { z } from 'zod'
import { db, projects, services, environments, eq, or, and } from '../lib/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/error'
import { param } from '../lib/params'
import { asyncHandler } from '../lib/asyncHandler'

const router = Router()

const createProjectSchema = z.object({
  name:   z.string().min(1).max(64),
  region: z.string().default('us-east-1'),
  orgId:  z.string().uuid().optional(),
})

const updateProjectSchema = z.object({
  name:      z.string().min(1).max(64).optional(),
  isPrivate: z.boolean().optional(),
  enabled:   z.boolean().optional(),
})

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function assertSlugAvailable(slug: string, orgId: string | null, ownerId: string, excludeProjectId?: string) {
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug),
        orgId ? eq(projects.orgId, orgId) : eq(projects.ownerId, ownerId),
      ),
    )
    .limit(1)

  if (existing.length > 0 && existing[0]!.id !== excludeProjectId) {
    throw new AppError(409, `Project with slug "${slug}" already exists`)
  }
}

router.get('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, req.user!.id))

  res.json(userProjects)
}))

router.post('/', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = createProjectSchema.parse(req.body)

  const slug = slugify(body.name)
  await assertSlugAvailable(slug, body.orgId ?? null, req.user!.id)

  const project = await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        ...body,
        slug,
        ownerId: req.user!.id,
      })
      .returning()

    await tx.insert(environments).values([
      { projectId: project.id, name: 'Production',  slug: 'production',  isDefault: true },
      { projectId: project.id, name: 'Development', slug: 'development', isDefault: false },
    ])

    return project
  })

  res.status(201).json(project)
}))

router.get('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, param(req.params.id)))
    .limit(1)

  if (!project) throw new AppError(404, 'Project not found')
  if (project.ownerId !== req.user!.id) throw new AppError(403, 'Forbidden')

  const projectServices = await db
    .select()
    .from(services)
    .where(eq(services.projectId, project.id))

  res.json({ ...project, services: projectServices })
}))

router.patch('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, param(req.params.id)))
    .limit(1)

  if (!project) throw new AppError(404, 'Project not found')
  if (project.ownerId !== req.user!.id) throw new AppError(403, 'Forbidden')

  const body = updateProjectSchema.parse(req.body)
  const updates: Partial<typeof projects.$inferInsert> = {}

  if (body.name !== undefined) {
    const slug = slugify(body.name)
    await assertSlugAvailable(slug, project.orgId, req.user!.id, project.id)
    updates.name = body.name
    updates.slug = slug
  }
  if (body.isPrivate !== undefined) updates.isPrivate = body.isPrivate
  if (body.enabled !== undefined) updates.enabled = body.enabled

  if (Object.keys(updates).length === 0) {
    return res.json(project)
  }

  const [updated] = await db
    .update(projects)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(projects.id, project.id))
    .returning()

  res.json(updated)
}))

router.delete('/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, param(req.params.id)))
    .limit(1)

  if (!project) throw new AppError(404, 'Project not found')
  if (project.ownerId !== req.user!.id) throw new AppError(403, 'Forbidden')

  await db.delete(projects).where(eq(projects.id, project.id))

  res.status(204).send()
}))

export default router
