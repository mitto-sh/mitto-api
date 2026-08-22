import { AppError } from '../middleware/error'
import * as projectsRepo from '../repositories/projects.repository'
import * as servicesRepo from '../repositories/services.repository'

export async function assertProjectOwner(projectId: string, userId: string) {
  const project = await projectsRepo.findById(projectId)
  if (!project) throw new AppError(404, 'Project not found')
  if (project.ownerId !== userId) throw new AppError(403, 'Forbidden')
  return project
}

export async function assertServiceOwner(serviceId: string, userId: string) {
  const service = await servicesRepo.findById(serviceId)
  if (!service) throw new AppError(404, 'Service not found')
  const project = await assertProjectOwner(service.projectId, userId)
  return { service, project }
}
