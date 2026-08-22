import { db, services, eq } from '../lib/db'
import type { NewService } from '../lib/db'

export async function findById(id: string) {
  const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1)
  return service
}

export async function findByProject(projectId: string) {
  return db.select().from(services).where(eq(services.projectId, projectId))
}

export async function insert(data: NewService) {
  const [service] = await db.insert(services).values(data).returning()
  return service
}

export async function update(id: string, data: Partial<NewService>) {
  const [updated] = await db.update(services).set(data).where(eq(services.id, id)).returning()
  return updated
}

export async function remove(id: string) {
  await db.delete(services).where(eq(services.id, id))
}
