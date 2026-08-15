import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { createApp } from '../../src/app'
import { db } from '../../src/db'
import { users, projects, services } from '../../src/db/schema'
import { createTestUser } from '../helpers/testUser'

const app = createApp()

async function setupProjectAndService(ownerId: string) {
  const [project] = await db
    .insert(projects)
    .values({ name: 'Env Test Project', slug: `env-test-${Date.now()}`, ownerId })
    .returning()

  const [service] = await db
    .insert(services)
    .values({ projectId: project!.id, name: 'web', type: 'web', port: 3000 })
    .returning()

  return { project: project!, service: service! }
}

describe('env vars routes', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(projects).where(eq(projects.ownerId, id))
      await db.delete(users).where(eq(users.id, id))
    }
  })

  async function user() {
    const { user, token } = await createTestUser()
    createdUserIds.push(user.id)
    return { user, token }
  }

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/env/some-id').expect(401)
  })

  it('rejects a key that is not uppercase-with-underscores', async () => {
    const { user: u, token } = await user()
    const { service } = await setupProjectAndService(u.id)

    await request(app)
      .put(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vars: [{ key: 'not-valid', value: 'x' }] })
      .expect(400)
  })

  it('upserts env vars and masks secrets on read', async () => {
    const { user: u, token } = await user()
    const { service } = await setupProjectAndService(u.id)

    await request(app)
      .put(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vars: [{ key: 'DATABASE_URL', value: 'postgres://secret', isSecret: true }] })
      .expect(200)

    const listRes = await request(app)
      .get(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listRes.body).toHaveLength(1)
    expect(listRes.body[0].value).toBe('***')
  })

  it('reveals non-secret values on read', async () => {
    const { user: u, token } = await user()
    const { service } = await setupProjectAndService(u.id)

    await request(app)
      .put(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vars: [{ key: 'PUBLIC_URL', value: 'https://example.com', isSecret: false }] })
      .expect(200)

    const listRes = await request(app)
      .get(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listRes.body[0].value).toBe('https://example.com')
  })

  it('actually persists a new value when updating an existing key (regression: onConflictDoUpdate)', async () => {
    const { user: u, token } = await user()
    const { service } = await setupProjectAndService(u.id)

    await request(app)
      .put(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vars: [{ key: 'API_KEY', value: 'first-value', isSecret: false }] })
      .expect(200)

    await request(app)
      .put(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vars: [{ key: 'API_KEY', value: 'second-value', isSecret: false }] })
      .expect(200)

    const listRes = await request(app)
      .get(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listRes.body).toHaveLength(1)
    expect(listRes.body[0].value).toBe('second-value')
  })

  it('deletes an env var by key', async () => {
    const { user: u, token } = await user()
    const { service } = await setupProjectAndService(u.id)

    await request(app)
      .put(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vars: [{ key: 'TO_DELETE', value: 'x', isSecret: false }] })
      .expect(200)

    await request(app)
      .delete(`/env/${service.id}/TO_DELETE`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    const listRes = await request(app)
      .get(`/env/${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listRes.body).toHaveLength(0)
  })

  it('rejects access to env vars of a service owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const { service } = await setupProjectAndService(owner.user.id)

    await request(app)
      .get(`/env/${service.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)
  })

  it('returns 404 for a nonexistent service', async () => {
    const { token } = await user()
    await request(app)
      .get('/env/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })
})
