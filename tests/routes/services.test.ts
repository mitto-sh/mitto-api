import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { createApp } from '../../src/app'
import { db } from '../../src/db'
import { users, projects } from '../../src/db/schema'
import { createTestUser } from '../helpers/testUser'

const app = createApp()

async function createProject(ownerId: string, token: string) {
  const res = await request(app)
    .post('/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Svc Test Project ${Date.now()}` })
    .expect(201)
  return res.body
}

describe('services routes', () => {
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
    await request(app).post('/services').send({}).expect(401)
  })

  it('creates a service under an owned project', async () => {
    const { user: u, token } = await user()
    const project = await createProject(u.id, token)

    const res = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'web', type: 'web', port: 3000 })
      .expect(201)

    expect(res.body.name).toBe('web')
    expect(res.body.projectId).toBe(project.id)
    expect(res.body.cpu).toBe(256) // default applied
  })

  it('rejects creating a service for a project owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const project = await createProject(owner.user.id, owner.token)

    await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ projectId: project.id, name: 'web', type: 'web' })
      .expect(403)
  })

  it('returns 404 creating a service for a nonexistent project', async () => {
    const { token } = await user()
    await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: '00000000-0000-0000-0000-000000000000', name: 'web', type: 'web' })
      .expect(404)
  })

  it('creates a service with its own repo, independent of the project', async () => {
    const { user: u, token } = await user()
    const project = await createProject(u.id, token)

    const res = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId: project.id,
        name: 'api',
        type: 'web',
        repoUrl: 'https://github.com/acme/api',
        repoProvider: 'github',
        defaultBranch: 'develop',
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        runtime: 'node',
      })
      .expect(201)

    expect(res.body.repoUrl).toBe('https://github.com/acme/api')
    expect(res.body.repoProvider).toBe('github')
    expect(res.body.defaultBranch).toBe('develop')
    expect(res.body.runtime).toBe('node')

    const res2 = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'worker', type: 'worker', repoUrl: 'https://github.com/acme/worker' })
      .expect(201)

    expect(res2.body.repoUrl).toBe('https://github.com/acme/worker')
  })

  it('rejects an invalid service type', async () => {
    const { user: u, token } = await user()
    const project = await createProject(u.id, token)

    await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'web', type: 'not-a-type' })
      .expect(400)
  })

  it('gets and deletes a service it owns', async () => {
    const { user: u, token } = await user()
    const project = await createProject(u.id, token)

    const created = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'worker', type: 'worker' })
      .expect(201)

    await request(app)
      .get(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    await request(app)
      .delete(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    await request(app)
      .get(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('rejects getting/deleting a service owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const project = await createProject(owner.user.id, owner.token)

    const created = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ projectId: project.id, name: 'web', type: 'web' })
      .expect(201)

    await request(app)
      .get(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)

    await request(app)
      .delete(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)
  })

  it('returns 404 for a nonexistent service', async () => {
    const { token } = await user()
    await request(app)
      .get('/services/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('defaults to enabled and can be disabled/re-enabled', async () => {
    const { user: u, token } = await user()
    const project = await createProject(u.id, token)

    const created = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.id, name: 'web', type: 'web' })
      .expect(201)
    expect(created.body.enabled).toBe(true)

    const disabled = await request(app)
      .patch(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false })
      .expect(200)
    expect(disabled.body.enabled).toBe(false)

    const reenabled = await request(app)
      .patch(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true })
      .expect(200)
    expect(reenabled.body.enabled).toBe(true)
  })

  it('rejects updating a service owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const project = await createProject(owner.user.id, owner.token)

    const created = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ projectId: project.id, name: 'web', type: 'web' })
      .expect(201)

    await request(app)
      .patch(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ enabled: false })
      .expect(403)
  })

  it('returns 404 updating a nonexistent service', async () => {
    const { token } = await user()
    await request(app)
      .patch('/services/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false })
      .expect(404)
  })
})
