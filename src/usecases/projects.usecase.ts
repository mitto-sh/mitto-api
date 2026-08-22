import { AppError } from '../middleware/error'
import { slugify } from '../lib/slug'
import { assertProjectOwner } from '../lib/ownership'
import * as projectsRepo from '../repositories/projects.repository'
import * as servicesRepo from '../repositories/services.repository'
import type { NewProject } from '../lib/db'
import type { CreateProjectInput, UpdateProjectInput } from '../dto/projects.dto'

async function assertSlugAvailable(
  slug: string,
  orgId: string | null,
  ownerId: string,
  excludeProjectId?: string,
) {
  const existing = await projectsRepo.findBySlugInScope(slug, orgId, ownerId)
  if (existing && existing.id !== excludeProjectId) {
    throw new AppError(409, `Project with slug "${slug}" already exists`)
  }
}

export async function listProjects(ownerId: string) {
  return projectsRepo.findByOwner(ownerId)
}

export async function createProject(ownerId: string, input: CreateProjectInput) {
  const slug = slugify(input.name)
  await assertSlugAvailable(slug, input.orgId ?? null, ownerId)

  return projectsRepo.insertWithDefaultEnvironments({
    ...input,
    slug,
    ownerId,
  })
}

export async function getProject(id: string, userId: string) {
  const project = await assertProjectOwner(id, userId)
  const services = await servicesRepo.findByProject(project.id)
  return { ...project, services }
}

export async function updateProject(id: string, userId: string, input: UpdateProjectInput) {
  const project = await assertProjectOwner(id, userId)

  const updates: Partial<NewProject> = {}

  if (input.name !== undefined) {
    const slug = slugify(input.name)
    await assertSlugAvailable(slug, project.orgId, userId, project.id)
    updates.name = input.name
    updates.slug = slug
  }
  if (input.isPrivate !== undefined) updates.isPrivate = input.isPrivate
  if (input.enabled !== undefined) updates.enabled = input.enabled

  if (Object.keys(updates).length === 0) {
    return project
  }

  return projectsRepo.update(project.id, { ...updates, updatedAt: new Date() })
}

export async function deleteProject(id: string, userId: string) {
  const project = await assertProjectOwner(id, userId)
  await projectsRepo.remove(project.id)
}
