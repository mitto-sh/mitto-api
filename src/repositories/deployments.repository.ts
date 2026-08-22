import { db, deployments, eq, and, desc } from '@/lib/db'
import type { NewDeployment } from '@/lib/db'

export async function findById(id: string) {
  const [deployment] = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1)
  return deployment
}

export async function findByService(serviceId: string, environmentId?: string) {
  return db
    .select()
    .from(deployments)
    .where(
      environmentId
        ? and(eq(deployments.serviceId, serviceId), eq(deployments.environmentId, environmentId))
        : eq(deployments.serviceId, serviceId),
    )
    .orderBy(desc(deployments.createdAt))
    .limit(20)
}

export async function insert(data: NewDeployment) {
  const [deployment] = await db.insert(deployments).values(data).returning()
  return deployment
}

export async function update(id: string, data: Partial<NewDeployment>) {
  const [updated] = await db.update(deployments).set(data).where(eq(deployments.id, id)).returning()
  return updated
}
