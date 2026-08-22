import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '@/app'
import { db, users, projects, eq } from '@/lib/db'
import { createTestUser } from '../helpers/testUser'

const app = createApp()

describe('projects routes', () => {
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
    await request(app).get('/projects').expect(401)
  })

  it('creates a project and lists it back', async () => {
    const { token } = await user()

    const createRes = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Cool App' })
      .expect(201)

    expect(createRes.body.slug).toBe('my-cool-app')

    const listRes = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listRes.body).toHaveLength(1)
    expect(listRes.body[0].name).toBe('My Cool App')
    expect(listRes.body[0].isPrivate).toBe(true)
    expect(listRes.body[0].enabled).toBe(true)
  })

  it('rejects creating a duplicate slug for the same owner', async () => {
    const { token } = await user()

    await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dup App' })
      .expect(201)

    await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dup App' })
      .expect(409)
  })

  it('gets a project by id with its services', async () => {
    const { token } = await user()

    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Detail App' })
      .expect(201)

    const detail = await request(app)
      .get(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(detail.body.services).toEqual([])
  })

  it('gets a project by slug with its services', async () => {
    const { token } = await user()

    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Slug App' })
      .expect(201)

    const detail = await request(app)
      .get(`/projects/by-slug/${created.body.slug}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(detail.body.id).toBe(created.body.id)
    expect(detail.body.services).toEqual([])
  })

  it('returns 404 getting a project by slug that does not exist or belongs to another user', async () => {
    const owner = await user()
    const intruder = await user()

    await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Someone Elses App' })
      .expect(201)

    await request(app)
      .get('/projects/by-slug/nonexistent-slug')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(404)

    await request(app)
      .get('/projects/by-slug/someone-elses-app')
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(404)
  })

  it('returns 404 for a nonexistent project', async () => {
    const { token } = await user()
    await request(app)
      .get('/projects/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('returns 403 when accessing a project owned by another user', async () => {
    const owner = await user()
    const intruder = await user()

    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Private App' })
      .expect(201)

    await request(app)
      .get(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)

    await request(app)
      .delete(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)
  })

  it('renames a project and regenerates its slug', async () => {
    const { token } = await user()
    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Name' })
      .expect(201)

    const updated = await request(app)
      .patch(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })
      .expect(200)

    expect(updated.body.name).toBe('New Name')
    expect(updated.body.slug).toBe('new-name')
  })

  it('rejects renaming into a slug already used by another project', async () => {
    const { token } = await user()
    await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Taken Name' })
      .expect(201)
    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Other Name' })
      .expect(201)

    await request(app)
      .patch(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Taken Name' })
      .expect(409)
  })

  it('allows renaming a project to its own current name (no-op slug collision)', async () => {
    const { token } = await user()
    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Same Name' })
      .expect(201)

    await request(app)
      .patch(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Same Name' })
      .expect(200)
  })

  it('toggles isPrivate and enabled independently', async () => {
    const { token } = await user()
    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Toggle App' })
      .expect(201)

    const updated = await request(app)
      .patch(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPrivate: false, enabled: false })
      .expect(200)

    expect(updated.body.isPrivate).toBe(false)
    expect(updated.body.enabled).toBe(false)
    expect(updated.body.name).toBe('Toggle App') // unchanged
  })

  it('returns the project unchanged when PATCH has no fields', async () => {
    const { token } = await user()
    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Untouched App' })
      .expect(201)

    const res = await request(app)
      .patch(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200)

    expect(res.body.name).toBe('Untouched App')
  })

  it('returns 404/403 patching a project that does not exist or is not owned', async () => {
    const owner = await user()
    const intruder = await user()
    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Guarded App' })
      .expect(201)

    await request(app)
      .patch('/projects/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'x' })
      .expect(404)

    await request(app)
      .patch(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ name: 'x' })
      .expect(403)
  })

  it('blocks triggering a deployment when the project is disabled', async () => {
    const { token } = await user()
    const project = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Disabled App' })
      .expect(201)

    await request(app)
      .patch(`/projects/${project.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false })
      .expect(200)

    const service = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId: project.body.id, name: 'web', type: 'web' })
      .expect(201)

    const envs = await request(app)
      .get(`/environments?projectId=${project.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.body.id, environmentId: envs.body[0].id })
      .expect(423)
  })

  it('deletes a project it owns', async () => {
    const { token } = await user()

    const created = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Deletable App' })
      .expect(201)

    await request(app)
      .delete(`/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    const [remaining] = await db.select().from(projects).where(eq(projects.id, created.body.id))
    expect(remaining).toBeUndefined()
  })
})
