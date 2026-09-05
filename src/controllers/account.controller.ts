import { Response } from 'express'
import { AuthRequest } from '@/middleware/auth'
import { param } from '@/lib/params'
import { setProviderSchema, createAgentSchema } from '@/dto/account.dto'
import * as accountUsecase from '@/usecases/account.usecase'

export async function getProvider(req: AuthRequest, res: Response) {
  res.json(await accountUsecase.getProvider(req.user!.id))
}

export async function setProvider(req: AuthRequest, res: Response) {
  const body = setProviderSchema.parse(req.body)
  res.json(await accountUsecase.setProvider(req.user!.id, body))
}

export async function listAgents(req: AuthRequest, res: Response) {
  res.json(await accountUsecase.listAgents(req.user!.id))
}

export async function createAgent(req: AuthRequest, res: Response) {
  const body = createAgentSchema.parse(req.body)
  res.status(201).json(await accountUsecase.createAgent(req.user!.id, body))
}

export async function revokeAgent(req: AuthRequest, res: Response) {
  await accountUsecase.revokeAgent(req.user!.id, param(req.params.id))
  res.status(204).send()
}
