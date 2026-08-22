import { env } from '@/config/env'
import { generateToken } from '@/middleware/auth'
import * as usersRepo from '@/repositories/users.repository'

export function getGithubAuthorizeUrl(): string {
  const params = new URLSearchParams({
    client_id:    env.GITHUB_CLIENT_ID,
    scope:        'user:email read:user',
    redirect_uri: `${env.PLATFORM_DOMAIN}/auth/github/callback`,
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

export type GithubLoginResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'oauth_failed' | 'no_verified_email' }

export async function loginWithGithubCode(code: string): Promise<GithubLoginResult> {
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
    return { ok: false, reason: 'oauth_failed' }
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
    return { ok: false, reason: 'no_verified_email' }
  }

  const user = await usersRepo.upsertByGithubId({
    email:     primaryEmail,
    name:      profile.name || profile.login,
    avatarUrl: profile.avatar_url,
    githubId:  String(profile.id),
  })

  return { ok: true, token: generateToken(user.id) }
}

export async function getMe(userId: string) {
  return usersRepo.findById(userId)
}
