import { z } from 'zod'

export const upsertEnvVarSchema = z.object({
  environmentId: z.string().uuid(),
  vars: z.array(z.object({
    key:      z.string().min(1).regex(/^[A-Z_][A-Z0-9_]*$/, 'Key must be uppercase with underscores'),
    value:    z.string(),
    isSecret: z.boolean().default(true),
  })).min(1),
})
export type UpsertEnvVarInput = z.infer<typeof upsertEnvVarSchema>
