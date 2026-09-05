import { describe, it, expect, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { createApp } from '@/app'
import { env } from '@/config/env'
import { db, users, providerAgents, eq } from '@/lib/db'
import { createTestUser } from '../helpers/testUser'

const app = createApp()

async function createAgent(token: string, name = 'vm') {
  const res = await request(app)
    .post('/account/agents')
    .set('Authorization', `Bearer ${token}`)
    .send({ name })
    .expect(201)
  return res.body as { id: string; token: string }
}

describe('agent session route', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(providerAgents).where(eq(providerAgents.userId, id))
      await db.delete(users).where(eq(users.id, id))
    }
  })

  async function user() {
    const { user, token } = await createTestUser()
    createdUserIds.push(user.id)
    return { user, token }
  }

  it('exchanges a valid agent token for a short-lived ws token and marks the agent online', async () => {
    const { user: u, token } = await user()
    const agent = await createAgent(token)

    const res = await request(app)
      .post('/agent/session')
      .send({ token: agent.token })
      .expect(200)

    expect(res.body.expiresIn).toBe(600)
    const claims = jwt.verify(res.body.wsToken, env.JWT_SECRET) as Record<string, unknown>
    expect(claims.role).toBe('agent')
    expect(claims.agentId).toBe(agent.id)
    expect(claims.userId).toBe(u.id)
    expect(claims.sub).toBe(`agent:${u.id}`)

    const [row] = await db.select().from(providerAgents).where(eq(providerAgents.id, agent.id))
    expect(row.status).toBe('online')
    expect(row.lastSeenAt).not.toBeNull()
  })

  it('rejects an unknown token', async () => {
    await request(app).post('/agent/session').send({ token: 'mag_nope' }).expect(401)
  })

  it('rejects a revoked agent token', async () => {
    const { token } = await user()
    const agent = await createAgent(token, 'to-revoke')

    await request(app)
      .delete(`/account/agents/${agent.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    await request(app).post('/agent/session').send({ token: agent.token }).expect(401)
  })

  it('validates the request body', async () => {
    await request(app).post('/agent/session').send({}).expect(400)
  })
})
