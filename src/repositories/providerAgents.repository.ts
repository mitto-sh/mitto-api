import { db, providerAgents, eq, and, isNull, asc } from '@/lib/db'
import type { NewProviderAgent } from '@/lib/db'

export async function findByUser(userId: string) {
  return db
    .select()
    .from(providerAgents)
    .where(eq(providerAgents.userId, userId))
    .orderBy(asc(providerAgents.createdAt))
}

export async function findById(id: string) {
  const [row] = await db.select().from(providerAgents).where(eq(providerAgents.id, id)).limit(1)
  return row
}

export async function findActiveByHash(tokenHash: string) {
  const [row] = await db
    .select()
    .from(providerAgents)
    .where(and(eq(providerAgents.tokenHash, tokenHash), isNull(providerAgents.revokedAt)))
    .limit(1)
  return row
}

export async function insert(data: NewProviderAgent) {
  const [row] = await db.insert(providerAgents).values(data).returning()
  return row
}

export async function markSeen(id: string, status: string) {
  const [row] = await db
    .update(providerAgents)
    .set({ status, lastSeenAt: new Date() })
    .where(eq(providerAgents.id, id))
    .returning()
  return row
}

export async function revoke(id: string) {
  const [row] = await db
    .update(providerAgents)
    .set({ revokedAt: new Date(), status: 'offline' })
    .where(and(eq(providerAgents.id, id), isNull(providerAgents.revokedAt)))
    .returning()
  return row
}
