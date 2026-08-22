import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '../../src/app'
import { db, users, projects, environments, eq } from '../../src/lib/db'
import { createTestUser } from '../helpers/testUser'

const app = createApp()

async function createProject(token: string) {
  const res = await request(app)
    .post('/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Env Test Project ${Date.now()}` })
    .expect(201)
  return res.body
}

describe('environments routes', () => {
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
    await request(app).get('/environments?projectId=x').expect(401)
  })

  it('auto-seeds Production/Dev when a project is created', async () => {
    const { token } = await user()
    const project = await createProject(token)

    const res = await request(app)
      .get(`/environments?projectId=${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body).toHaveLength(2)
    expect(res.body[0].name).toBe('Production')
    expect(res.body[0].isDefault).toBe(true)
    expect(res.body.map((e: { slug: string }) => e.slug).sort()).toEqual(['development', 'production'])
  })

  it('requires projectId query param on list', async () => {
    const { token } = await user()
    await request(app)
      .get('/environments')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
  })

  it('rejects listing environments for a project owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const project = await createProject(owner.token)

    await request(app)
      .get(`/environments?projectId=${project.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)
  })

  it('creates a custom environment and rejects a duplicate slug', async () => {
    const { token } = await user()
    const project = await createProject(token)

    const created = await request(app)
      .post('/environments')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'Staging' })
      .expect(201)

    expect(created.body.slug).toBe('staging')
    expect(created.body.isDefault).toBe(false)

    await request(app)
      .post('/environments')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'Staging' })
      .expect(409)
  })

  it('renames an environment and regenerates its slug', async () => {
    const { token } = await user()
    const project = await createProject(token)

    const created = await request(app)
      .post('/environments')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'Preprod' })
      .expect(201)

    const updated = await request(app)
      .patch(`/environments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Pre Prod' })
      .expect(200)

    expect(updated.body.slug).toBe('pre-prod')
  })

  it('rejects deleting the default environment', async () => {
    const { token } = await user()
    const project = await createProject(token)

    const envs = await request(app)
      .get(`/environments?projectId=${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const production = envs.body.find((e: { isDefault: boolean }) => e.isDefault)

    await request(app)
      .delete(`/environments/${production.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)
  })

  it('rejects deleting the last remaining environment even if not marked default', async () => {
    const { token } = await user()
    const project = await createProject(token)

    const envs = await request(app)
      .get(`/environments?projectId=${project.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const nonDefault = envs.body.filter((e: { isDefault: boolean }) => !e.isDefault)

    // delete the non-default seeded environment (Development) — leaves only Production
    for (const env of nonDefault) {
      await request(app)
        .delete(`/environments/${env.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204)
    }

    const production = envs.body.find((e: { isDefault: boolean }) => e.isDefault)

    // unset isDefault directly to isolate the "last remaining" guard from the
    // (always-true-in-practice) "can't delete the default" guard
    await db.update(environments).set({ isDefault: false }).where(eq(environments.id, production.id))

    await request(app)
      .delete(`/environments/${production.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)
  })

  it('deletes a custom environment it owns', async () => {
    const { token } = await user()
    const project = await createProject(token)

    const created = await request(app)
      .post('/environments')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'Temp' })
      .expect(201)

    await request(app)
      .delete(`/environments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)
  })

  it('returns 404 for a nonexistent environment', async () => {
    const { token } = await user()
    await request(app)
      .patch('/environments/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'x' })
      .expect(404)
  })
})
