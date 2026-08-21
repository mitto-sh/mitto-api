import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const REQUIRED_ENV = {
  DATABASE_URL: 'postgres://mitto:mitto@localhost:15432/mitto',
  JWT_SECRET: 'a'.repeat(32),
  GITHUB_CLIENT_ID: 'gh-id',
  GITHUB_CLIENT_SECRET: 'gh-secret',
  ENCRYPTION_KEY: 'b'.repeat(32),
}

describe('env config', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('parses valid environment variables, applying defaults', async () => {
    process.env = { ...originalEnv, ...REQUIRED_ENV, NODE_ENV: 'test' }
    delete process.env.PLATFORM_DOMAIN
    delete process.env.PORT
    delete process.env.REDIS_URL
    const { env } = await import('../../src/config/env')

    expect(env.NODE_ENV).toBe('test')
    expect(env.PORT).toBe(4000)
    expect(env.REDIS_URL).toBe('redis://localhost:4003')
    expect(env.PLATFORM_DOMAIN).toBe('mitto.sh')
  })

  it('exits the process when required variables are missing', async () => {
    process.env = { ...originalEnv }
    delete process.env.DATABASE_URL
    delete process.env.JWT_SECRET
    delete process.env.GITHUB_CLIENT_ID
    delete process.env.GITHUB_CLIENT_SECRET
    delete process.env.ENCRYPTION_KEY

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(import('../../src/config/env')).rejects.toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
