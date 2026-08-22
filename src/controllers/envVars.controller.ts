import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { param, requireQueryParam } from '../lib/params'
import { upsertEnvVarSchema } from '../dto/envVars.dto'
import * as envVarsUsecase from '../usecases/envVars.usecase'

export async function list(req: AuthRequest, res: Response) {
  const serviceId = param(req.params.serviceId)
  const environmentId = requireQueryParam(req.query, 'environmentId')
  res.json(await envVarsUsecase.listEnvVars(serviceId, environmentId, req.user!.id))
}

export async function upsert(req: AuthRequest, res: Response) {
  const serviceId = param(req.params.serviceId)
  const body = upsertEnvVarSchema.parse(req.body)
  res.json(await envVarsUsecase.upsertEnvVars(serviceId, req.user!.id, body))
}

export async function remove(req: AuthRequest, res: Response) {
  const serviceId = param(req.params.serviceId)
  const key = param(req.params.key)
  const environmentId = requireQueryParam(req.query, 'environmentId')
  await envVarsUsecase.deleteEnvVar(serviceId, environmentId, key, req.user!.id)
  res.status(204).send()
}
