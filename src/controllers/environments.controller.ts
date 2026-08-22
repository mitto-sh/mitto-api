import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { param, requireQueryParam } from '../lib/params'
import { createEnvironmentSchema, updateEnvironmentSchema } from '../dto/environments.dto'
import * as environmentsUsecase from '../usecases/environments.usecase'

export async function list(req: AuthRequest, res: Response) {
  const projectId = requireQueryParam(req.query, 'projectId')
  res.json(await environmentsUsecase.listEnvironments(projectId, req.user!.id))
}

export async function create(req: AuthRequest, res: Response) {
  const body = createEnvironmentSchema.parse(req.body)
  res.status(201).json(await environmentsUsecase.createEnvironment(req.user!.id, body))
}

export async function update(req: AuthRequest, res: Response) {
  const body = updateEnvironmentSchema.parse(req.body)
  res.json(await environmentsUsecase.updateEnvironment(param(req.params.id), req.user!.id, body))
}

export async function remove(req: AuthRequest, res: Response) {
  await environmentsUsecase.deleteEnvironment(param(req.params.id), req.user!.id)
  res.status(204).send()
}
