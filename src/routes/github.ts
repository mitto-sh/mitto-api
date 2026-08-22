import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { db, githubInstallations, eq, and } from '../lib/db'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { AppError } from '../middleware/error'
import { asyncHandler } from '../lib/asyncHandler'
import { param } from '../lib/params'
import { env } from '../config/env'
import {
  installUrl,
  getInstallationDetails,
  listInstallationRepos,
  fetchRepoFile,
} from '../lib/githubApp'
import { parseMittoConfig, MITTO_CONFIG_FILENAME } from '../lib/mittoConfig'

const router = Router()

const STATE_TTL = '10m'

router.get('/install-url', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const state = jwt.sign({ sub: req.user!.id }, env.JWT_SECRET, { expiresIn: STATE_TTL })
  res.json({ url: `${installUrl()}?state=${state}` })
}))

router.get('/app/callback', asyncHandler(async (req: Request, res: Response) => {
  const { installation_id, state } = req.query

  if (!installation_id || typeof installation_id !== 'string' || !state || typeof state !== 'string') {
    return res.redirect(`${env.DASHBOARD_URL}/projects?github_error=missing_params`)
  }

  let userId: string
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as { sub: string }
    userId = payload.sub
  } catch {
    return res.redirect(`${env.DASHBOARD_URL}/projects?github_error=invalid_state`)
  }

  const details = await getInstallationDetails(installation_id)

  await db
    .insert(githubInstallations)
    .values({
      userId,
      installationId: installation_id,
      accountLogin: details.account?.login ?? 'unknown',
      accountType: details.account?.type ?? 'User',
    })
    .onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: { userId },
    })

  res.redirect(`${env.DASHBOARD_URL}/projects?github_connected=1`)
}))

router.get('/installations', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const rows = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.userId, req.user!.id))

  res.json(rows)
}))

async function assertInstallationOwner(installationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(githubInstallations)
    .where(and(eq(githubInstallations.installationId, installationId), eq(githubInstallations.userId, userId)))
    .limit(1)

  if (!row) throw new AppError(404, 'GitHub installation not found')
  return row
}

router.get('/installations/:id/repos', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const installationId = param(req.params.id)
  await assertInstallationOwner(installationId, req.user!.id)

  const repos = await listInstallationRepos(installationId)
  res.json(repos)
}))

router.get('/installations/:id/repos/:owner/:repo/config', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const installationId = param(req.params.id)
  await assertInstallationOwner(installationId, req.user!.id)

  const owner = param(req.params.owner)
  const repo = param(req.params.repo)

  const content = await fetchRepoFile(installationId, owner, repo, MITTO_CONFIG_FILENAME)
  if (content === null) {
    return res.json({ found: false })
  }

  const result = parseMittoConfig(content)
  if (!result.valid) {
    return res.json({ found: true, valid: false, error: result.error })
  }

  res.json({ found: true, valid: true, config: result.config })
}))

export default router
