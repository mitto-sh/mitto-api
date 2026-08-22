import { z } from 'zod'

export const triggerDeploySchema = z.object({
  serviceId:     z.string().uuid(),
  environmentId: z.string().uuid(),
  commitSha:     z.string().optional(),
  commitMessage: z.string().optional(),
})
export type TriggerDeployInput = z.infer<typeof triggerDeploySchema>
