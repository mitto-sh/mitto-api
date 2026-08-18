import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth'
import { env } from '../config/env'
import { asyncHandler } from '../lib/asyncHandler'

const router = Router()

router.get('/github', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id:    env.GITHUB_CLIENT_ID,
    scope:        'user:email read:user',
    redirect_uri: `${env.PLATFORM_DOMAIN}/auth/github/callback`,
  })
  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

function redirectToLoginError(res: Response, error: string) {
  res.redirect(`${env.DASHBOARD_URL}/login?error=${error}`)
}

router.get('/github/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    return redirectToLoginError(res, 'missing_code')
  }

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
    return redirectToLoginError(res, 'oauth_failed')
  }

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
    return redirectToLoginError(res, 'no_verified_email')
  }

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

  res.redirect(`${env.DASHBOARD_URL}/auth/callback?token=${jwt}`)
}))

router.get('/me', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.user!.id))
    .limit(1)

  res.json(user)
}))

export default router
