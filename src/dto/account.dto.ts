import { z } from 'zod'
import { PROVIDER_KINDS } from 'mitto-lib-ts-orm'

export const setProviderSchema = z.object({
  kind: z.enum(PROVIDER_KINDS),
})
export type SetProviderInput = z.infer<typeof setProviderSchema>

export const createAgentSchema = z.object({
  name: z.string().min(1).max(64),
})
export type CreateAgentInput = z.infer<typeof createAgentSchema>

export const agentSessionSchema = z.object({
  token: z.string().min(1),
})
export type AgentSessionInput = z.infer<typeof agentSessionSchema>
