import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import { db, users, eq } from '../../src/lib/db'
import { env } from '../../src/config/env'
import { requireAuth, generateToken, type AuthRequest } from '../../src/middleware/auth'

function mockRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('auth middleware', () => {
  let userId: string

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({ email: 'auth-test@example.com', name: 'Auth Test' })
      .onConflictDoUpdate({ target: users.email, set: { name: 'Auth Test' } })
      .returning()
    userId = user!.id
  })

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId))
  })

  it('generateToken produces a JWT verifiable with JWT_SECRET', () => {
    const token = generateToken(userId)
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string }
    expect(payload.sub).toBe(userId)
  })

  it('rejects requests with no authorization header', async () => {
    const req = { headers: {} } as AuthRequest
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with a malformed authorization header', async () => {
    const req = { headers: { authorization: 'Basic xyz' } } as AuthRequest
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects an invalid/expired token', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } } as AuthRequest
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' })
  })

  it('rejects a valid token whose user no longer exists', async () => {
    const token = generateToken('00000000-0000-0000-0000-000000000000')
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' })
  })

  it('attaches req.user and calls next for a valid token', async () => {
    const token = generateToken(userId)
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest
    const res = mockRes()
    const next = vi.fn()

    await requireAuth(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.user?.id).toBe(userId)
    expect(req.user?.email).toBe('auth-test@example.com')
  })
})
