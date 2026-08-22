import { AppError } from '../middleware/error'
import { slugify } from '../lib/slug'
import { assertProjectOwner } from '../lib/ownership'
import * as environmentsRepo from '../repositories/environments.repository'
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from '../dto/environments.dto'

async function assertSlugAvailable(projectId: string, slug: string, excludeEnvironmentId?: string) {
  const existing = await environmentsRepo.findBySlugInProject(projectId, slug)
  if (existing && existing.id !== excludeEnvironmentId) {
    throw new AppError(409, `Environment with slug "${slug}" already exists in this project`)
  }
}

async function getOwnedEnvironment(id: string, userId: string) {
  const environment = await environmentsRepo.findById(id)
  if (!environment) throw new AppError(404, 'Environment not found')
  await assertProjectOwner(environment.projectId, userId)
  return environment
}

export async function listEnvironments(projectId: string, userId: string) {
  await assertProjectOwner(projectId, userId)
  return environmentsRepo.findByProject(projectId)
}

export async function createEnvironment(userId: string, input: CreateEnvironmentInput) {
  await assertProjectOwner(input.projectId, userId)

  const slug = slugify(input.name)
  await assertSlugAvailable(input.projectId, slug)

  return environmentsRepo.insert({
    projectId: input.projectId,
    name: input.name,
    slug,
    isDefault: false,
  })
}

export async function updateEnvironment(id: string, userId: string, input: UpdateEnvironmentInput) {
  const environment = await getOwnedEnvironment(id, userId)

  const slug = slugify(input.name)
  await assertSlugAvailable(environment.projectId, slug, environment.id)

  return environmentsRepo.update(id, { name: input.name, slug })
}

export async function deleteEnvironment(id: string, userId: string) {
  const environment = await getOwnedEnvironment(id, userId)

  if (environment.isDefault) {
    throw new AppError(409, 'The default environment cannot be deleted')
  }

  const count = await environmentsRepo.countInProjectExcluding(environment.projectId, id)
  if (count === 0) {
    throw new AppError(409, 'A project must have at least one environment')
  }

  await environmentsRepo.remove(id)
}
