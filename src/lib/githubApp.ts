import { readFileSync } from 'fs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'
import { AppError } from '../middleware/error'

export interface GithubAppConfig {
  appId: string
  slug: string
  clientId: string
  clientSecret: string
  privateKey: string
}

let cachedPrivateKey: string | null = null

export function getGithubAppConfig(): GithubAppConfig {
  const { GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_PRIVATE_KEY_PATH } = env

  if (!GITHUB_APP_ID || !GITHUB_APP_SLUG || !GITHUB_APP_CLIENT_ID || !GITHUB_APP_CLIENT_SECRET || !GITHUB_APP_PRIVATE_KEY_PATH) {
    throw new AppError(501, 'GitHub App is not configured on this server')
  }

  if (!cachedPrivateKey) {
    cachedPrivateKey = readFileSync(GITHUB_APP_PRIVATE_KEY_PATH, 'utf8')
  }

  return {
    appId: GITHUB_APP_ID,
    slug: GITHUB_APP_SLUG,
    clientId: GITHUB_APP_CLIENT_ID,
    clientSecret: GITHUB_APP_CLIENT_SECRET,
    privateKey: cachedPrivateKey,
  }
}

export function installUrl(): string {
  const { slug } = getGithubAppConfig()
  return `https://github.com/apps/${slug}/installations/new`
}

// Short-lived (max 10 min) JWT the App uses to authenticate as itself, per
// https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app
function signAppJwt(): string {
  const { appId, privateKey } = getGithubAppConfig()
  const now = Math.floor(Date.now() / 1000)

  return jwt.sign(
    { iat: now - 60, exp: now + 9 * 60, iss: appId },
    privateKey,
    { algorithm: 'RS256' },
  )
}

async function githubAppFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${signAppJwt()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  })

  if (!res.ok) {
    throw new AppError(res.status, `GitHub App API request failed: ${path}`)
  }

  return res
}

export interface InstallationDetails {
  id: number
  account: { login: string; type: string } | null
}

export async function getInstallationDetails(installationId: string): Promise<InstallationDetails> {
  const res = await githubAppFetch(`/app/installations/${installationId}`)
  return res.json() as Promise<InstallationDetails>
}

export async function getInstallationAccessToken(installationId: string): Promise<string> {
  const res = await githubAppFetch(`/app/installations/${installationId}/access_tokens`, { method: 'POST' })
  const body = await res.json() as { token: string }
  return body.token
}

export interface GithubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  default_branch: string
  html_url: string
}

export async function listInstallationRepos(installationId: string): Promise<GithubRepo[]> {
  const token = await getInstallationAccessToken(installationId)
  const repos: GithubRepo[] = []
  let page = 1

  while (true) {
    const res = await fetch(`https://api.github.com/installation/repositories?per_page=100&page=${page}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) throw new AppError(res.status, 'Failed to list repositories from GitHub')

    const body = await res.json() as { repositories: GithubRepo[] }
    repos.push(...body.repositories)
    if (body.repositories.length < 100) break
    page += 1
  }

  return repos
}

// Returns the decoded text content of a file at the repo root, or null if it doesn't exist.
export async function fetchRepoFile(installationId: string, owner: string, repo: string, path: string): Promise<string | null> {
  const token = await getInstallationAccessToken(installationId)
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (res.status === 404) return null
  if (!res.ok) throw new AppError(res.status, `Failed to fetch ${path} from ${owner}/${repo}`)

  const body = await res.json() as { content: string; encoding: string }
  return Buffer.from(body.content, body.encoding as BufferEncoding).toString('utf8')
}
