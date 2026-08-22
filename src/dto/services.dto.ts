import { z } from 'zod'

export const createServiceSchema = z.object({
  projectId:      z.string().uuid(),
  name:           z.string().min(1).max(64),
  type:           z.enum(['web', 'worker', 'cron', 'static']),
  port:           z.number().int().positive().optional(),
  cpu:            z.number().int().positive().default(256),
  memory:         z.number().int().positive().default(512),
  minReplicas:    z.number().int().min(0).default(1),
  maxReplicas:    z.number().int().min(1).default(3),
  healthCheck:    z.string().default('/healthz'),
  dockerfilePath: z.string().default('Dockerfile'),
  repoUrl:        z.string().url().optional(),
  repoProvider:   z.enum(['github', 'gitlab', 'bitbucket']).optional(),
  defaultBranch:  z.string().default('main'),
  buildCommand:   z.string().optional(),
  startCommand:   z.string().optional(),
  outputDir:      z.string().optional(),
  runtime:        z.enum(['node', 'python', 'static', 'docker']).optional(),
})
export type CreateServiceInput = z.infer<typeof createServiceSchema>

export const updateServiceSchema = z.object({
  enabled: z.boolean().optional(),
})
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>
