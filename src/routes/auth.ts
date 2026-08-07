import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth'
import { env } from '../config/env'
import { AppError } from '../middleware/error'

const router = Router()

// ── GET /auth/github ──────────────────────────────────────────────────────────
// Redirect to GitHub OAuth
router.get('/github', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id:    env.GITHUB_CLIENT_ID,
    scope:        'user:email read:user',
    redirect_uri: `${env.PLATFORM_DOMAIN}/auth/github/callback`,
  })
  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// ── GET /auth/github/callback ─────────────────────────────────────────────────
// GitHub sends back a code — exchange for access token, upsert user, return JWT
router.get('/github/callback', async (req: Request, res: Response) => {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    throw new AppError(400, 'Missing code from GitHub')
  }

  // Exchange code for GitHub access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id:     env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

  if (!tokenData.access_token) {
    throw new AppError(401, 'GitHub OAuth failed')
  }

  // Fetch GitHub user profile
  const [profileRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    }),
  ])

  const profile = await profileRes.json() as {
    id: number; name: string; avatar_url: string; login: string
  }
  const emails = await emailsRes.json() as Array<{
    email: string; primary: boolean; verified: boolean
  }>

  const primaryEmail = emails.find((e) => e.primary && e.verified)?.email

  if (!primaryEmail) {
    throw new AppError(400, 'No verified primary email found on GitHub account')
  }

  // Upsert user
  const [user] = await db
    .insert(users)
    .values({
      email:     primaryEmail,
      name:      profile.name || profile.login,
      avatarUrl: profile.avatar_url,
      githubId:  String(profile.id),
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        name:      profile.name || profile.login,
        avatarUrl: profile.avatar_url,
        updatedAt: new Date(),
      },
    })
    .returning()

  const jwt = generateToken(user.id)

  res.json({ token: jwt, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } })
})

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.id))
    .limit(1)

  res.json(user)
})

export default router
