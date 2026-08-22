import { db, users, eq } from '@/lib/db'

export async function findById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return user
}

export async function findAuthProfileById(id: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, plan: users.plan })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return user
}

interface GithubProfile {
  email: string
  name: string
  avatarUrl: string
  githubId: string
}

export async function upsertByGithubId(profile: GithubProfile) {
  const [user] = await db
    .insert(users)
    .values({
      email:     profile.email,
      name:      profile.name,
      avatarUrl: profile.avatarUrl,
      githubId:  profile.githubId,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        name:      profile.name,
        avatarUrl: profile.avatarUrl,
        updatedAt: new Date(),
      },
    })
    .returning()

  return user
}
