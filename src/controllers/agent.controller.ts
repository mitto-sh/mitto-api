import { Request, Response } from 'express'
import { agentSessionSchema } from '@/dto/account.dto'
import * as agentUsecase from '@/usecases/agent.usecase'

export async function openSession(req: Request, res: Response) {
  const body = agentSessionSchema.parse(req.body)
  res.json(await agentUsecase.openAgentSession(body))
}
