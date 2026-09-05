import { AppError } from '@/middleware/error'
import { generateAgentToken } from '@/lib/agentToken'
import * as providerConfigsRepo from '@/repositories/providerConfigs.repository'
import * as providerAgentsRepo from '@/repositories/providerAgents.repository'
import type { ProviderAgent } from '@/lib/db'
import type { SetProviderInput, CreateAgentInput } from '@/dto/account.dto'

const DEFAULT_PROVIDER_KIND = 'cloud-managed'

export async function getProvider(userId: string) {
  const config = await providerConfigsRepo.findByUser(userId)
  return {
    kind: config?.kind ?? DEFAULT_PROVIDER_KIND,
    updatedAt: config?.updatedAt ?? null,
  }
}

export async function setProvider(userId: string, input: SetProviderInput) {
  const config = await providerConfigsRepo.upsertKind(userId, input.kind)
  return { kind: config.kind, updatedAt: config.updatedAt }
}

function toAgentView(agent: ProviderAgent) {
  return {
    id: agent.id,
    name: agent.name,
    tokenPrefix: agent.tokenPrefix,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt,
    createdAt: agent.createdAt,
    revokedAt: agent.revokedAt,
  }
}

export async function listAgents(userId: string) {
  const agents = await providerAgentsRepo.findByUser(userId)
  return agents.map(toAgentView)
}

export async function createAgent(userId: string, input: CreateAgentInput) {
  const { token, tokenHash, tokenPrefix } = generateAgentToken()
  const agent = await providerAgentsRepo.insert({
    userId,
    name: input.name,
    tokenHash,
    tokenPrefix,
  })
  return { ...toAgentView(agent), token }
}

export async function revokeAgent(userId: string, agentId: string) {
  const agent = await providerAgentsRepo.findById(agentId)
  if (!agent || agent.userId !== userId) throw new AppError(404, 'Agent not found')

  const revoked = await providerAgentsRepo.revoke(agentId)
  if (!revoked) throw new AppError(409, 'Agent is already revoked')
}
