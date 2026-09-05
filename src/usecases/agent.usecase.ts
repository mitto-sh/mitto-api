import jwt from 'jsonwebtoken'
import { env } from '@/config/env'
import { AppError } from '@/middleware/error'
import { AGENT_WS_TOKEN_TTL_SECONDS } from '@/lib/consts'
import { hashAgentToken } from '@/lib/agentToken'
import { AgentStatus } from '@/lib/db'
import * as providerAgentsRepo from '@/repositories/providerAgents.repository'
import type { AgentSessionInput } from '@/dto/account.dto'

export async function openAgentSession(input: AgentSessionInput) {
  const agent = await providerAgentsRepo.findActiveByHash(hashAgentToken(input.token))
  if (!agent) throw new AppError(401, 'Invalid or revoked agent token')

  await providerAgentsRepo.markSeen(agent.id, AgentStatus.Online)

  const wsToken = jwt.sign(
    { sub: `agent:${agent.userId}`, role: 'agent', agentId: agent.id, userId: agent.userId },
    env.JWT_SECRET,
    { expiresIn: AGENT_WS_TOKEN_TTL_SECONDS },
  )

  return { wsToken, expiresIn: AGENT_WS_TOKEN_TTL_SECONDS }
}
