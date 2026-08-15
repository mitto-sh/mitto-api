import { db } from '../../src/db'
import { users } from '../../src/db/schema'
import { generateToken } from '../../src/middleware/auth'

let counter = 0

export async function createTestUser(overrides: Partial<{ email: string; name: string }> = {}) {
  counter += 1
  const [user] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `test-user-${Date.now()}-${counter}@example.com`,
      name: overrides.name ?? 'Test User',
    })
    .returning()

  const token = generateToken(user!.id)
  return { user: user!, token }
}
