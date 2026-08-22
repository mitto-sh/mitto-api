import { db, projects, services, eq } from './db'
import { AppError } from '../middleware/error'

export async function assertProjectOwner(projectId: string, userId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
  if (!project) throw new AppError(404, 'Project not found')
  if (project.ownerId !== userId) throw new AppError(403, 'Forbidden')
  return project
}

export async function assertServiceOwner(serviceId: string, userId: string) {
  const [service] = await db.select().from(services).where(eq(services.id, serviceId)).limit(1)
  if (!service) throw new AppError(404, 'Service not found')
  const project = await assertProjectOwner(service.projectId, userId)
  return { service, project }
}
