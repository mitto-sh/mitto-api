import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from '@/config/env'
import { errorHandler, notFound } from '@/middleware/error'

import authRoutes        from '@/routes/auth.routes'
import projectsRoutes    from '@/routes/projects.routes'
import servicesRoutes    from '@/routes/services.routes'
import deploymentsRoutes from '@/routes/deployments.routes'
import envVarsRoutes     from '@/routes/envVars.routes'
import githubRoutes      from '@/routes/github.routes'
import environmentsRoutes from '@/routes/environments.routes'
import accountRoutes     from '@/routes/account.routes'
import agentRoutes       from '@/routes/agent.routes'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', service: 'mitto-api', env: env.NODE_ENV })
  })

  app.use('/auth',        authRoutes)
  app.use('/projects',    projectsRoutes)
  app.use('/services',    servicesRoutes)
  app.use('/deployments', deploymentsRoutes)
  app.use('/env',         envVarsRoutes)
  app.use('/github',      githubRoutes)
  app.use('/environments', environmentsRoutes)
  app.use('/account',     accountRoutes)
  app.use('/agent',       agentRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

export const app = createApp()
