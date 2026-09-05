import { db, providerConfigs, eq } from '@/lib/db'
import type { ProviderKind } from 'mitto-lib-ts-orm'

export async function findByUser(userId: string) {
  const [row] = await db.select().from(providerConfigs).where(eq(providerConfigs.userId, userId)).limit(1)
  return row
}

export async function upsertKind(userId: string, kind: ProviderKind) {
  const [row] = await db
    .insert(providerConfigs)
    .values({ userId, kind })
    .onConflictDoUpdate({
      target: providerConfigs.userId,
      set: { kind, updatedAt: new Date() },
    })
    .returning()
  return row
}
