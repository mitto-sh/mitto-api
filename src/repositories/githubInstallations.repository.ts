import { db, githubInstallations, eq, and } from '@/lib/db'

export async function findByUser(userId: string) {
  return db.select().from(githubInstallations).where(eq(githubInstallations.userId, userId))
}

export async function findByInstallationAndUser(installationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(githubInstallations)
    .where(and(eq(githubInstallations.installationId, installationId), eq(githubInstallations.userId, userId)))
    .limit(1)
  return row
}

export async function upsert(data: {
  userId: string
  installationId: string
  accountLogin: string
  accountType: string
}) {
  await db
    .insert(githubInstallations)
    .values(data)
    .onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: { userId: data.userId },
    })
}
