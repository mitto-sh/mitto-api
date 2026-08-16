import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { generateKeyPairSync } from 'crypto'

const mockEnv: Record<string, string | undefined> = {
  GITHUB_APP_ID: undefined,
  GITHUB_APP_SLUG: undefined,
  GITHUB_APP_CLIENT_ID: undefined,
  GITHUB_APP_CLIENT_SECRET: undefined,
  GITHUB_APP_PRIVATE_KEY_PATH: undefined,
}

vi.mock('../../src/config/env', () => ({
  get env() {
    return mockEnv
  },
}))

let privateKeyPem: string

vi.mock('fs', () => ({
  readFileSync: vi.fn(() => privateKeyPem),
}))

function configureApp() {
  mockEnv.GITHUB_APP_ID = '12345'
  mockEnv.GITHUB_APP_SLUG = 'mitto-sh-dev'
  mockEnv.GITHUB_APP_CLIENT_ID = 'client-id'
  mockEnv.GITHUB_APP_CLIENT_SECRET = 'client-secret'
  mockEnv.GITHUB_APP_PRIVATE_KEY_PATH = '/fake/path/key.pem'
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

beforeAll(() => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  })
  privateKeyPem = privateKey
})

afterEach(() => {
  vi.unstubAllGlobals()
  for (const key of Object.keys(mockEnv)) mockEnv[key] = undefined
})

describe('githubApp', () => {
  it('throws a 501 AppError when the GitHub App is not configured', async () => {
    const { getGithubAppConfig } = await import('../../src/lib/githubApp')
    expect(() => getGithubAppConfig()).toThrow('GitHub App is not configured')
  })

  it('builds the installation URL from the configured slug', async () => {
    configureApp()
    const { installUrl } = await import('../../src/lib/githubApp')
    expect(installUrl()).toBe('https://github.com/apps/mitto-sh-dev/installations/new')
  })

  it('fetches installation details using a signed app JWT', async () => {
    configureApp()
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { id: 999, account: { login: 'acme', type: 'Organization' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { getInstallationDetails } = await import('../../src/lib/githubApp')
    const details = await getInstallationDetails('999')

    expect(details.account?.login).toBe('acme')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.github.com/app/installations/999')
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer /)
  })

  it('throws when the GitHub API responds with an error', async () => {
    configureApp()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(404, {})))

    const { getInstallationDetails } = await import('../../src/lib/githubApp')
    await expect(getInstallationDetails('999')).rejects.toThrow('GitHub App API request failed')
  })

  it('exchanges for an installation access token', async () => {
    configureApp()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(201, { token: 'ghs_abc123' })))

    const { getInstallationAccessToken } = await import('../../src/lib/githubApp')
    expect(await getInstallationAccessToken('999')).toBe('ghs_abc123')
  })

  it('paginates through installation repositories', async () => {
    configureApp()
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i, name: `repo-${i}`, full_name: `acme/repo-${i}`, private: false, default_branch: 'main', html_url: '',
    }))
    const page2 = [{ id: 100, name: 'repo-100', full_name: 'acme/repo-100', private: false, default_branch: 'main', html_url: '' }]

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, { token: 'ghs_abc123' })) // access token exchange
      .mockResolvedValueOnce(jsonResponse(200, { repositories: page1 }))
      .mockResolvedValueOnce(jsonResponse(200, { repositories: page2 }))
    vi.stubGlobal('fetch', fetchMock)

    const { listInstallationRepos } = await import('../../src/lib/githubApp')
    const repos = await listInstallationRepos('999')

    expect(repos).toHaveLength(101)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('fetches and decodes a repo file, or returns null when missing', async () => {
    configureApp()
    const content = Buffer.from('services:\n  - name: web\n    type: web\n').toString('base64')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, { token: 'ghs_abc123' }))
      .mockResolvedValueOnce(jsonResponse(200, { content, encoding: 'base64' }))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchRepoFile } = await import('../../src/lib/githubApp')
    const result = await fetchRepoFile('999', 'acme', 'web', 'mitto.yaml')
    expect(result).toContain('name: web')
  })

  it('returns null when the repo file does not exist', async () => {
    configureApp()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(201, { token: 'ghs_abc123' }))
      .mockResolvedValueOnce(jsonResponse(404, {}))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchRepoFile } = await import('../../src/lib/githubApp')
    expect(await fetchRepoFile('999', 'acme', 'web', 'mitto.yaml')).toBeNull()
  })
})
