import { describe, it, expect, vi, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '@/app'
import { db, users, githubInstallations, eq } from '@/lib/db'
import { createTestUser } from '../helpers/testUser'
import { env } from '@/config/env'

vi.mock('@/clients/githubApp', () => ({
  installUrl: vi.fn(() => 'https://github.com/apps/mitto-sh-dev/installations/new'),
  getInstallationDetails: vi.fn(),
  getInstallationAccessToken: vi.fn(),
  listInstallationRepos: vi.fn(),
  fetchRepoFile: vi.fn(),
}))

import * as githubApp from '@/clients/githubApp'

const app = createApp()

describe('github routes', () => {
  const createdUserIds: string[] = []

  afterEach(() => {
    vi.clearAllMocks()
  })

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(githubInstallations).where(eq(githubInstallations.userId, id))
      await db.delete(users).where(eq(users.id, id))
    }
  })

  async function user() {
    const { user, token } = await createTestUser()
    createdUserIds.push(user.id)
    return { user, token }
  }

  it('rejects unauthenticated requests for install-url', async () => {
    await request(app).get('/github/install-url').expect(401)
  })

  it('returns an install URL with a state token bound to the user', async () => {
    const { token } = await user()
    const res = await request(app)
      .get('/github/install-url')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.url).toMatch(/^https:\/\/github\.com\/apps\/mitto-sh-dev\/installations\/new\?state=/)
    const state = res.body.url.split('state=')[1]
    const payload = jwt.verify(state, env.JWT_SECRET) as { sub: string }
    expect(payload.sub).toBeTruthy()
  })

  it('redirects to the dashboard with an error when the callback is missing params', async () => {
    const res = await request(app).get('/github/app/callback').expect(302)
    expect(res.headers.location).toBe(`${env.DASHBOARD_URL}/projects?github_error=missing_params`)
  })

  it('redirects to the dashboard with an error when the state token is invalid', async () => {
    const res = await request(app)
      .get('/github/app/callback?installation_id=999&state=not-a-real-jwt')
      .expect(302)
    expect(res.headers.location).toBe(`${env.DASHBOARD_URL}/projects?github_error=invalid_state`)
  })

  it('completes the callback: stores the installation and redirects to the dashboard', async () => {
    const { user: u } = await user()
    const state = jwt.sign({ sub: u.id }, env.JWT_SECRET, { expiresIn: '10m' })
    vi.mocked(githubApp.getInstallationDetails).mockResolvedValue({
      id: 999,
      account: { login: 'acme', type: 'Organization' },
    })

    const res = await request(app)
      .get(`/github/app/callback?installation_id=999&state=${state}`)
      .expect(302)

    expect(res.headers.location).toBe(`${env.DASHBOARD_URL}/projects?github_connected=1`)

    const [row] = await db.select().from(githubInstallations).where(eq(githubInstallations.userId, u.id))
    expect(row?.accountLogin).toBe('acme')
    expect(row?.accountType).toBe('Organization')
  })

  it('lists installations for the current user', async () => {
    const { user: u, token } = await user()
    const state = jwt.sign({ sub: u.id }, env.JWT_SECRET, { expiresIn: '10m' })
    vi.mocked(githubApp.getInstallationDetails).mockResolvedValue({
      id: 1000,
      account: { login: 'acme2', type: 'User' },
    })
    await request(app).get(`/github/app/callback?installation_id=1000&state=${state}`).expect(302)

    const res = await request(app)
      .get('/github/installations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body).toHaveLength(1)
    expect(res.body[0].accountLogin).toBe('acme2')
  })

  it('returns 404 listing repos for an installation that does not belong to the user', async () => {
    const { token } = await user()
    await request(app)
      .get('/github/installations/00000000/repos')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  it('lists repos for an owned installation', async () => {
    const { user: u, token } = await user()
    const state = jwt.sign({ sub: u.id }, env.JWT_SECRET, { expiresIn: '10m' })
    vi.mocked(githubApp.getInstallationDetails).mockResolvedValue({ id: 1001, account: { login: 'acme3', type: 'User' } })
    await request(app).get(`/github/app/callback?installation_id=1001&state=${state}`).expect(302)

    vi.mocked(githubApp.listInstallationRepos).mockResolvedValue([
      { id: 1, name: 'api', full_name: 'acme3/api', private: false, default_branch: 'main', html_url: '' },
    ])

    const res = await request(app)
      .get('/github/installations/1001/repos')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('api')
  })

  it('returns found:false when the repo has no mitto.yaml', async () => {
    const { user: u, token } = await user()
    const state = jwt.sign({ sub: u.id }, env.JWT_SECRET, { expiresIn: '10m' })
    vi.mocked(githubApp.getInstallationDetails).mockResolvedValue({ id: 1002, account: { login: 'acme4', type: 'User' } })
    await request(app).get(`/github/app/callback?installation_id=1002&state=${state}`).expect(302)

    vi.mocked(githubApp.fetchRepoFile).mockResolvedValue(null)

    const res = await request(app)
      .get('/github/installations/1002/repos/acme4/api/config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body).toEqual({ found: false })
  })

  it('parses a valid mitto.yaml from the repo', async () => {
    const { user: u, token } = await user()
    const state = jwt.sign({ sub: u.id }, env.JWT_SECRET, { expiresIn: '10m' })
    vi.mocked(githubApp.getInstallationDetails).mockResolvedValue({ id: 1003, account: { login: 'acme5', type: 'User' } })
    await request(app).get(`/github/app/callback?installation_id=1003&state=${state}`).expect(302)

    vi.mocked(githubApp.fetchRepoFile).mockResolvedValue('services:\n  - name: web\n    type: web\n    port: 3000\n')

    const res = await request(app)
      .get('/github/installations/1003/repos/acme5/api/config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.found).toBe(true)
    expect(res.body.valid).toBe(true)
    expect(res.body.config.services[0].name).toBe('web')
  })

  it('reports an invalid mitto.yaml without throwing', async () => {
    const { user: u, token } = await user()
    const state = jwt.sign({ sub: u.id }, env.JWT_SECRET, { expiresIn: '10m' })
    vi.mocked(githubApp.getInstallationDetails).mockResolvedValue({ id: 1004, account: { login: 'acme6', type: 'User' } })
    await request(app).get(`/github/app/callback?installation_id=1004&state=${state}`).expect(302)

    vi.mocked(githubApp.fetchRepoFile).mockResolvedValue('services:\n  - name: web\n    type: not-real\n')

    const res = await request(app)
      .get('/github/installations/1004/repos/acme6/api/config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.found).toBe(true)
    expect(res.body.valid).toBe(false)
  })
})
