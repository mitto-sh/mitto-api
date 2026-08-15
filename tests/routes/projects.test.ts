import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { eq } from 'drizzle-orm'
import { createApp } from '../../src/app'
import { db } from '../../src/db'
import { users, projects } from '../../src/db/schema'
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
