import { Router, Response } from 'express'
import { z } from 'zod'
import { db } from '../db'
import { projects, services } from '../db/schema'
import { eq, or, and } from 'drizzle-orm'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/error'
import { param } from '../lib/params'

const router = Router()

const createProjectSchema = z.object({
  name:          z.string().min(1).max(64),
  repoUrl:       z.string().url().optional(),
  repoProvider:  z.enum(['github', 'gitlab', 'bitbucket']).optional(),
  defaultBranch: z.string().default('main'),
  runtime:       z.enum(['node', 'python', 'static', 'docker']).optional(),
  region:        z.string().default('us-east-1'),
  orgId:         z.string().uuid().optional(),
})

// Slugify helper
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ── GET /projects ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, req.user!.id))

  res.json(userProjects)
})

// ── POST /projects ────────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const body = createProjectSchema.parse(req.body)

  const slug = slugify(body.name)

  // Check slug uniqueness for this user/org
  const existing = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug),
        body.orgId
          ? eq(projects.orgId, body.orgId)
          : eq(projects.ownerId, req.user!.id),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    throw new AppError(409, `Project with slug "${slug}" already exists`)
  }

  const [project] = await db
    .insert(projects)
    .values({
      ...body,
      slug,
      ownerId: req.user!.id,
    })
    .returning()

  res.status(201).json(project)
})

// ── GET /projects/:id ─────────────────────────────────────────────────────────
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
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
})

// ── DELETE /projects/:id ──────────────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, param(req.params.id)))
    .limit(1)

  if (!project) throw new AppError(404, 'Project not found')
  if (project.ownerId !== req.user!.id) throw new AppError(403, 'Forbidden')

  await db.delete(projects).where(eq(projects.id, project.id))

  res.status(204).send()
})

export default router
