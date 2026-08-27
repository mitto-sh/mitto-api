import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import { createApp } from '@/app'
import { db, users, projects, services, environments, eq } from '@/lib/db'
import { createTestUser } from '../helpers/testUser'
import { deployQueue } from '@/queues/deploy'

const app = createApp()

async function setupProjectAndService(ownerId: string) {
  const [project] = await db
    .insert(projects)
    .values({ name: 'Deploy Test Project', slug: `deploy-test-${Date.now()}`, ownerId })
    .returning()

  const [service] = await db
    .insert(services)
    .values({ projectId: project!.id, name: 'web', type: 'web', port: 3000 })
    .returning()

  const [environment] = await db
    .insert(environments)
    .values({ projectId: project!.id, name: 'Production', slug: 'production', isDefault: true })
    .returning()

  return { project: project!, service: service!, environment: environment! }
}

describe('deployments routes', () => {
  const createdUserIds: string[] = []

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(projects).where(eq(projects.ownerId, id))
      await db.delete(users).where(eq(users.id, id))
    }
    await deployQueue.close()
  })

  async function user() {
    const { user, token } = await createTestUser()
    createdUserIds.push(user.id)
    return { user, token }
  }

  it('requires serviceId query param on list', async () => {
    const { token } = await user()
    await request(app)
      .get('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
  })

  it('triggers a deployment, enqueues a job, and lists it', async () => {
    const { user: u, token } = await user()
    const { service, environment } = await setupProjectAndService(u.id)

    const triggerRes = await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.id, environmentId: environment.id, commitSha: 'abc123', commitMessage: 'test commit' })
      .expect(202)

    expect(triggerRes.body.status).toBe('queued')

    const listRes = await request(app)
      .get(`/deployments?serviceId=${service.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(listRes.body).toHaveLength(1)
    expect(listRes.body[0].id).toBe(triggerRes.body.id)
  })

  it('rejects triggering a deployment for a service owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const { service, environment } = await setupProjectAndService(owner.user.id)

    await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ serviceId: service.id, environmentId: environment.id })
      .expect(403)
  })

  it('rejects triggering a deployment for a disabled service', async () => {
    const { user: u, token } = await user()
    const { service, environment } = await setupProjectAndService(u.id)

    await db.update(services).set({ enabled: false }).where(eq(services.id, service.id))

    const res = await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.id, environmentId: environment.id })
      .expect(423)

    expect(res.body.error).toMatch(/disabled/i)
  })

  it('returns 404 triggering a deployment for a nonexistent service', async () => {
    const { token } = await user()
    await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: '00000000-0000-0000-0000-000000000000', environmentId: '00000000-0000-0000-0000-000000000000' })
      .expect(404)
  })

  it('gets a deployment by id and cancels it', async () => {
    const { user: u, token } = await user()
    const { service, environment } = await setupProjectAndService(u.id)

    const triggerRes = await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.id, environmentId: environment.id })
      .expect(202)

    const getRes = await request(app)
      .get(`/deployments/${triggerRes.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(getRes.body.id).toBe(triggerRes.body.id)

    const cancelRes = await request(app)
      .post(`/deployments/${triggerRes.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(cancelRes.body.status).toBe('cancelled')
  })

  it('issues a deployment-scoped logs token', async () => {
    const { user: u, token } = await user()
    const { service, environment } = await setupProjectAndService(u.id)

    const triggerRes = await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.id, environmentId: environment.id })
      .expect(202)

    const res = await request(app)
      .get(`/deployments/${triggerRes.body.id}/logs-token`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const jwt = await import('jsonwebtoken')
    const { env } = await import('@/config/env')
    const payload = jwt.default.verify(res.body.token, env.JWT_SECRET) as { sub: string; deploymentId: string }
    expect(payload.sub).toBe(u.id)
    expect(payload.deploymentId).toBe(triggerRes.body.id)
  })

  it('rejects a logs token request for a deployment owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const { service, environment } = await setupProjectAndService(owner.user.id)

    const triggerRes = await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ serviceId: service.id, environmentId: environment.id })
      .expect(202)

    await request(app)
      .get(`/deployments/${triggerRes.body.id}/logs-token`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)
  })

  it('rejects listing, getting, and canceling deployments for a service owned by another user', async () => {
    const owner = await user()
    const intruder = await user()
    const { service, environment } = await setupProjectAndService(owner.user.id)

    const triggerRes = await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ serviceId: service.id, environmentId: environment.id })
      .expect(202)

    await request(app)
      .get(`/deployments?serviceId=${service.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)

    await request(app)
      .get(`/deployments/${triggerRes.body.id}`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)

    await request(app)
      .post(`/deployments/${triggerRes.body.id}/cancel`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .expect(403)
  })

  it('returns 404 canceling a nonexistent deployment', async () => {
    const { token } = await user()
    await request(app)
      .post('/deployments/00000000-0000-0000-0000-000000000000/cancel')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('rejects canceling a deployment that already finished', async () => {
    const { user: u, token } = await user()
    const { service, environment } = await setupProjectAndService(u.id)

    const triggerRes = await request(app)
      .post('/deployments')
      .set('Authorization', `Bearer ${token}`)
      .send({ serviceId: service.id, environmentId: environment.id })
      .expect(202)

    await request(app)
      .post(`/deployments/${triggerRes.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    await request(app)
      .post(`/deployments/${triggerRes.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
  })
})
