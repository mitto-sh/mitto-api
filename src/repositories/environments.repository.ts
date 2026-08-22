import { db, environments, eq, and, ne, asc, desc, sql } from '@/lib/db'
import type { NewEnvironment } from '@/lib/db'

export async function findById(id: string) {
  const [environment] = await db.select().from(environments).where(eq(environments.id, id)).limit(1)
  return environment
}

export async function findByProject(projectId: string) {
  return db
    .select()
    .from(environments)
    .where(eq(environments.projectId, projectId))
    .orderBy(desc(environments.isDefault), asc(environments.createdAt))
}

export async function findBySlugInProject(projectId: string, slug: string) {
  const [row] = await db
    .select({ id: environments.id })
    .from(environments)
    .where(and(eq(environments.projectId, projectId), eq(environments.slug, slug)))
    .limit(1)
  return row
}

export async function countInProjectExcluding(projectId: string, excludeId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(environments)
    .where(and(eq(environments.projectId, projectId), ne(environments.id, excludeId)))
  return count
}

export async function insert(data: NewEnvironment) {
  const [environment] = await db.insert(environments).values(data).returning()
  return environment
}

export async function update(id: string, data: Partial<NewEnvironment>) {
  const [updated] = await db.update(environments).set(data).where(eq(environments.id, id)).returning()
  return updated
}

export async function remove(id: string) {
  await db.delete(environments).where(eq(environments.id, id))
}
