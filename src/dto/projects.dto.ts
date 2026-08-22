import { z } from 'zod'

export const createProjectSchema = z.object({
  name:   z.string().min(1).max(64),
  region: z.string().default('us-east-1'),
  orgId:  z.string().uuid().optional(),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = z.object({
  name:      z.string().min(1).max(64).optional(),
  isPrivate: z.boolean().optional(),
  enabled:   z.boolean().optional(),
})
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
