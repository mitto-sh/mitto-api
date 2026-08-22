import { describe, it, expect, vi, afterEach, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../../src/app'
import { db, users, eq } from '../../src/lib/db'
import { createTestUser } from '../helpers/testUser'
import { env } from '../../src/config/env'

const app = createApp()

function jsonResponse(body: unknown) {
  return { json: async () => body } as Response
}

describe('auth routes', () => {
  const createdUserIds: string[] = []

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    for (const id of createdUserIds) {
      await db.delete(users).where(eq(users.id, id))
    }
  })

  it('redirects to GitHub OAuth with the configured client id', async () => {
    const res = await request(app).get('/auth/github').expect(302)
    expect(res.headers.location).toContain('github.com/login/oauth/authorize')
    expect(res.headers.location).toContain(`client_id=${env.GITHUB_CLIENT_ID}`)
  })

  it('redirects to the dashboard login with an error when no code is provided', async () => {
    const res = await request(app).get('/auth/github/callback').expect(302)
    expect(res.headers.location).toBe(`${env.DASHBOARD_URL}/login?error=missing_code`)
  })

  it('redirects to the dashboard login with an error when GitHub does not return an access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'bad_verification_code' })))

    const res = await request(app).get('/auth/github/callback?code=abc').expect(302)
    expect(res.headers.location).toBe(`${env.DASHBOARD_URL}/login?error=oauth_failed`)
  })

  it('redirects to the dashboard login with an error when the GitHub account has no verified primary email', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gh-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 1, name: 'No Email', avatar_url: '', login: 'noemail' }))
      .mockResolvedValueOnce(jsonResponse([{ email: 'x@example.com', primary: false, verified: true }]))
    vi.stubGlobal('fetch', fetchMock)

    const res = await request(app).get('/auth/github/callback?code=abc').expect(302)
    expect(res.headers.location).toBe(`${env.DASHBOARD_URL}/login?error=no_verified_email`)
  })

  it('creates a user and redirects to the dashboard with a JWT on a successful callback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'gh-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 999001, name: 'GH User', avatar_url: 'http://x/a.png', login: 'ghuser' }))
      .mockResolvedValueOnce(jsonResponse([{ email: 'ghuser@example.com', primary: true, verified: true }]))
    vi.stubGlobal('fetch', fetchMock)

    const res = await request(app).get('/auth/github/callback?code=abc').expect(302)

    const location = new URL(res.headers.location)
    expect(location.origin + location.pathname).toBe(`${env.DASHBOARD_URL}/auth/callback`)
    const token = location.searchParams.get('token')
    expect(token).toBeTruthy()

    const payload = jwt.verify(token!, env.JWT_SECRET) as { sub: string }
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    expect(user?.email).toBe('ghuser@example.com')
    createdUserIds.push(payload.sub)
  })

  it('rejects /auth/me without a token', async () => {
    await request(app).get('/auth/me').expect(401)
  })

  it('returns the authenticated user profile on /auth/me', async () => {
    const { user, token } = await createTestUser()
    createdUserIds.push(user.id)

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(res.body.id).toBe(user.id)
    expect(res.body.email).toBe(user.email)
  })
})
