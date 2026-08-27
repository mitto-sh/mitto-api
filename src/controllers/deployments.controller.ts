import { Response } from 'express'
import { AuthRequest } from '@/middleware/auth'
import { param, requireQueryParam } from '@/lib/params'
import { triggerDeploySchema } from '@/dto/deployments.dto'
import * as deploymentsUsecase from '@/usecases/deployments.usecase'

export async function list(req: AuthRequest, res: Response) {
  const serviceId = requireQueryParam(req.query, 'serviceId')
  const { environmentId } = req.query
  res.json(await deploymentsUsecase.listDeployments(
    serviceId,
    req.user!.id,
    typeof environmentId === 'string' ? environmentId : undefined,
  ))
}

export async function trigger(req: AuthRequest, res: Response) {
  const body = triggerDeploySchema.parse(req.body)
  res.status(202).json(await deploymentsUsecase.triggerDeploy(req.user!.id, body))
}

export async function get(req: AuthRequest, res: Response) {
  res.json(await deploymentsUsecase.getDeployment(param(req.params.id), req.user!.id))
}

export async function cancel(req: AuthRequest, res: Response) {
  res.json(await deploymentsUsecase.cancelDeployment(param(req.params.id), req.user!.id))
}

export async function logsToken(req: AuthRequest, res: Response) {
  res.json(await deploymentsUsecase.getLogsToken(param(req.params.id), req.user!.id))
}
