import { z } from 'zod'

export const createEnvironmentSchema = z.object({
  projectId: z.string().uuid(),
  name:      z.string().min(1).max(64),
})
export type CreateEnvironmentInput = z.infer<typeof createEnvironmentSchema>

export const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(64),
})
export type UpdateEnvironmentInput = z.infer<typeof updateEnvironmentSchema>
