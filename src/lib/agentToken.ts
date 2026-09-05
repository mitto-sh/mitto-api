import { createHash, randomBytes } from 'crypto'

export const AGENT_TOKEN_PREFIX = 'mag_'
const RANDOM_BYTES = 32
const DISPLAY_PREFIX_LENGTH = AGENT_TOKEN_PREFIX.length + 8

export interface GeneratedAgentToken {
  token: string
  tokenHash: string
  tokenPrefix: string
}

export function generateAgentToken(): GeneratedAgentToken {
  const token = AGENT_TOKEN_PREFIX + randomBytes(RANDOM_BYTES).toString('base64url')
  return {
    token,
    tokenHash: hashAgentToken(token),
    tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  }
}

export function hashAgentToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
