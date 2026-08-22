import { Response } from 'express'
import { AuthRequest } from '@/middleware/auth'
import { param } from '@/lib/params'
import { createServiceSchema, updateServiceSchema } from '@/dto/services.dto'
import * as servicesUsecase from '@/usecases/services.usecase'

export async function create(req: AuthRequest, res: Response) {
  const body = createServiceSchema.parse(req.body)
  res.status(201).json(await servicesUsecase.createService(req.user!.id, body))
}

export async function get(req: AuthRequest, res: Response) {
  res.json(await servicesUsecase.getService(param(req.params.id), req.user!.id))
}

export async function update(req: AuthRequest, res: Response) {
  const body = updateServiceSchema.parse(req.body)
  res.json(await servicesUsecase.updateService(param(req.params.id), req.user!.id, body))
}

export async function remove(req: AuthRequest, res: Response) {
  await servicesUsecase.deleteService(param(req.params.id), req.user!.id)
  res.status(204).send()
}
