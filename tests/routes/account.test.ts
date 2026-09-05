import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '@/app'
import { db, users, providerConfigs, providerAgents, eq } from '@/lib/db'
import { createTestUser } from '../helpers/testUser'

const app = createApp()

describe('account routes', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(providerAgents).where(eq(providerAgents.userId, id))
      await db.delete(providerConfigs).where(eq(providerConfigs.userId, id))
      await db.delete(users).where(eq(users.id, id))
    }
  })

  async function user() {
    const { user, token } = await createTestUser()
    createdUserIds.push(user.id)
    return { user, token }
  }

  it('rejects unauthenticated requests', async () => {
    await request(app).get('/account/provider').expect(401)
  })

  it('defaults the provider to cloud-managed before anything is set', async () => {
    const { token } = await user()
    const res = await request(app)
      .get('/account/provider')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.kind).toBe('cloud-managed')
    expect(res.body.updatedAt).toBeNull()
  })

  it('sets and then reads back the provider kind', async () => {
    const { token } = await user()

    const put = await request(app)
      .put('/account/provider')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'self-hosted-vm' })
      .expect(200)
    expect(put.body.kind).toBe('self-hosted-vm')

    const get = await request(app)
      .get('/account/provider')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(get.body.kind).toBe('self-hosted-vm')

    const update = await request(app)
      .put('/account/provider')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'cloud-managed' })
      .expect(200)
    expect(update.body.kind).toBe('cloud-managed')
  })

  it('rejects an unknown provider kind', async () => {
    const { token } = await user()
    await request(app)
      .put('/account/provider')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'self-hosted-azure' })
      .expect(400)
  })

  it('creates an agent, returns the token once, and lists it without the token', async () => {
    const { token } = await user()

    const created = await request(app)
      .post('/account/agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'prod-vm' })
      .expect(201)

    expect(created.body.name).toBe('prod-vm')
    expect(created.body.token).toMatch(/^mag_/)
    expect(created.body.tokenPrefix).toBe(created.body.token.slice(0, 12))
    expect(created.body.status).toBe('offline')

    const list = await request(app)
      .get('/account/agents')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(list.body).toHaveLength(1)
    expect(list.body[0].token).toBeUndefined()
    expect(list.body[0].tokenPrefix).toBe(created.body.tokenPrefix)
  })

  it('revokes an agent and refuses to revoke it twice', async () => {
    const { token } = await user()

    const created = await request(app)
      .post('/account/agents')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'laptop' })
      .expect(201)

    await request(app)
      .delete(`/account/agents/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    await request(app)
      .delete(`/account/agents/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)

    const list = await request(app)
      .get('/account/agents')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(list.body[0].revokedAt).not.toBeNull()
  })

  it('does not let a user revoke an agent owned by someone else', async () => {
    const owner = await user()
    const intruder = await user()

    const created = await request(app)
      .post('/account/agents')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'owned' })
      .expect(201)

    await request(app)
      .delete(`/account/agents/${created.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(404)
  })
})
