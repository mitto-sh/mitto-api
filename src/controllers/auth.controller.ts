import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { env } from '../config/env'
import * as authUsecase from '../usecases/auth.usecase'

function redirectToLoginError(res: Response, error: string) {
  res.redirect(`${env.DASHBOARD_URL}/login?error=${error}`)
}

export function redirectToGithub(_req: Request, res: Response) {
  res.redirect(authUsecase.getGithubAuthorizeUrl())
}

export async function githubCallback(req: Request, res: Response) {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    return redirectToLoginError(res, 'missing_code')
  }

  const result = await authUsecase.loginWithGithubCode(code)

  if (!result.ok) {
    return redirectToLoginError(res, result.reason)
  }

  res.redirect(`${env.DASHBOARD_URL}/auth/callback?token=${result.token}`)
}

export async function me(req: AuthRequest, res: Response) {
  res.json(await authUsecase.getMe(req.user!.id))
}
