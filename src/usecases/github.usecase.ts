import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AppError } from '../middleware/error'
import {
  installUrl,
  getInstallationDetails,
  listInstallationRepos,
  fetchRepoFile,
} from '../lib/githubApp'
import { parseMittoConfig } from '../lib/mittoConfig'
import { MITTO_CONFIG_FILENAME, GITHUB_INSTALL_STATE_TTL } from '../lib/consts'
import * as githubInstallationsRepo from '../repositories/githubInstallations.repository'

export function getInstallUrl(userId: string): string {
  const state = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: GITHUB_INSTALL_STATE_TTL })
  return `${installUrl()}?state=${state}`
}

export function verifyInstallState(state: string): string {
  const payload = jwt.verify(state, env.JWT_SECRET) as { sub: string }
  return payload.sub
}

export async function completeInstallation(installationId: string, userId: string) {
  const details = await getInstallationDetails(installationId)

  await githubInstallationsRepo.upsert({
    userId,
    installationId,
    accountLogin: details.account?.login ?? 'unknown',
    accountType: details.account?.type ?? 'User',
  })
}

export async function listInstallations(userId: string) {
  return githubInstallationsRepo.findByUser(userId)
}

async function assertInstallationOwner(installationId: string, userId: string) {
  const row = await githubInstallationsRepo.findByInstallationAndUser(installationId, userId)
  if (!row) throw new AppError(404, 'GitHub installation not found')
  return row
}

export async function listRepos(installationId: string, userId: string) {
  await assertInstallationOwner(installationId, userId)
  return listInstallationRepos(installationId)
}

export async function getRepoConfig(installationId: string, userId: string, owner: string, repo: string) {
  await assertInstallationOwner(installationId, userId)

  const content = await fetchRepoFile(installationId, owner, repo, MITTO_CONFIG_FILENAME)
  if (content === null) {
    return { found: false as const }
  }

  const result = parseMittoConfig(content)
  if (!result.valid) {
    return { found: true as const, valid: false as const, error: result.error }
  }

  return { found: true as const, valid: true as const, config: result.config }
}
