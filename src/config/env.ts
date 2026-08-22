import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().default('redis://localhost:4003'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),

  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_CLIENT_ID: z.string().optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional(),

  GITLAB_CLIENT_ID: z.string().optional(),
  GITLAB_CLIENT_SECRET: z.string().optional(),

  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  ECR_REGISTRY: z.string().optional(),

  TF_CLOUD_TOKEN: z.string().optional(),
  TF_CLOUD_ORG: z.string().optional(),

  PLATFORM_DOMAIN: z.string().default('mitto.sh'),
  DASHBOARD_URL: z.string().default('http://localhost:4001'),
  ENCRYPTION_KEY: z.string().min(32),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
