import { Request, Response } from 'express'
import { AuthRequest } from '@/middleware/auth'
import { param } from '@/lib/params'
import { env } from '@/config/env'
import * as githubUsecase from '@/usecases/github.usecase'

export function getInstallUrl(req: AuthRequest, res: Response) {
  res.json({ url: githubUsecase.getInstallUrl(req.user!.id) })
}

export async function installCallback(req: Request, res: Response) {
  const { installation_id, state } = req.query

  if (!installation_id || typeof installation_id !== 'string' || !state || typeof state !== 'string') {
    return res.redirect(`${env.DASHBOARD_URL}/projects?github_error=missing_params`)
  }

  let userId: string
  try {
    userId = githubUsecase.verifyInstallState(state)
  } catch {
    return res.redirect(`${env.DASHBOARD_URL}/projects?github_error=invalid_state`)
  }

  await githubUsecase.completeInstallation(installation_id, userId)

  res.redirect(`${env.DASHBOARD_URL}/projects?github_connected=1`)
}

export async function listInstallations(req: AuthRequest, res: Response) {
  res.json(await githubUsecase.listInstallations(req.user!.id))
}

export async function listRepos(req: AuthRequest, res: Response) {
  const installationId = param(req.params.id)
  res.json(await githubUsecase.listRepos(installationId, req.user!.id))
}

export async function getRepoConfig(req: AuthRequest, res: Response) {
  const installationId = param(req.params.id)
  const owner = param(req.params.owner)
  const repo = param(req.params.repo)
  res.json(await githubUsecase.getRepoConfig(installationId, req.user!.id, owner, repo))
}
