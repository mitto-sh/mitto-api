import { db, projects, environments, eq, and } from '../lib/db'
import type { NewProject, Project } from '../lib/db'

export async function findById(id: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1)
  return project
}

export async function findByOwner(ownerId: string) {
  return db.select().from(projects).where(eq(projects.ownerId, ownerId))
}

export async function findBySlugInScope(slug: string, orgId: string | null, ownerId: string) {
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug),
        orgId ? eq(projects.orgId, orgId) : eq(projects.ownerId, ownerId),
      ),
    )
    .limit(1)
  return row
}

export async function insertWithDefaultEnvironments(data: NewProject): Promise<Project> {
  return db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values(data).returning()

    await tx.insert(environments).values([
      { projectId: project.id, name: 'Production',  slug: 'production',  isDefault: true },
      { projectId: project.id, name: 'Development', slug: 'development', isDefault: false },
    ])

    return project
  })
}

export async function update(id: string, data: Partial<NewProject>) {
  const [updated] = await db.update(projects).set(data).where(eq(projects.id, id)).returning()
  return updated
}

export async function remove(id: string) {
  await db.delete(projects).where(eq(projects.id, id))
}
