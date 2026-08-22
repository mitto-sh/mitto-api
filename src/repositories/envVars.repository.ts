import { db, environmentVariables, eq, and, sql } from '@/lib/db'
import type { NewEnvVar } from '@/lib/db'

export async function findByServiceAndEnvironment(serviceId: string, environmentId: string) {
  return db
    .select()
    .from(environmentVariables)
    .where(
      and(
        eq(environmentVariables.serviceId, serviceId),
        eq(environmentVariables.environmentId, environmentId),
      ),
    )
}

export async function upsert(rows: NewEnvVar[]) {
  return db
    .insert(environmentVariables)
    .values(rows)
    .onConflictDoUpdate({
      target: [environmentVariables.serviceId, environmentVariables.environmentId, environmentVariables.key],
      set: {
        value: sql`excluded.value`,
        isSecret: sql`excluded.is_secret`,
      },
    })
    .returning()
}

export async function remove(serviceId: string, environmentId: string, key: string) {
  await db
    .delete(environmentVariables)
    .where(
      and(
        eq(environmentVariables.serviceId, serviceId),
        eq(environmentVariables.environmentId, environmentId),
        eq(environmentVariables.key, key),
      ),
    )
}
