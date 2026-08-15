import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env'
import { errorHandler, notFound } from './middleware/error'

// Routes
import authRoutes        from './routes/auth'
import projectsRoutes    from './routes/projects'
import servicesRoutes    from './routes/services'
import deploymentsRoutes from './routes/deployments'
import envVarsRoutes     from './routes/envVars'

export function createApp() {
  const app = express()

  // ── Middleware ──────────────────────────────────────────────────────────────
  app.use(helmet())
  app.use(cors())
  app.use(express.json())

  // ── Health check ────────────────────────────────────────────────────────────
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', service: 'mitto-api', env: env.NODE_ENV })
  })

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use('/auth',        authRoutes)
  app.use('/projects',    projectsRoutes)
  app.use('/services',    servicesRoutes)
  app.use('/deployments', deploymentsRoutes)
  app.use('/env',         envVarsRoutes)

  // ── Error handling ──────────────────────────────────────────────────────────
  app.use(notFound)
  app.use(errorHandler)

  return app
}

export const app = createApp()
