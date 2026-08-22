import { Response } from 'express'
import { AuthRequest } from '@/middleware/auth'
import { param } from '@/lib/params'
import { createProjectSchema, updateProjectSchema } from '@/dto/projects.dto'
import * as projectsUsecase from '@/usecases/projects.usecase'

export async function list(req: AuthRequest, res: Response) {
  res.json(await projectsUsecase.listProjects(req.user!.id))
}

export async function create(req: AuthRequest, res: Response) {
  const body = createProjectSchema.parse(req.body)
  res.status(201).json(await projectsUsecase.createProject(req.user!.id, body))
}

export async function get(req: AuthRequest, res: Response) {
  res.json(await projectsUsecase.getProject(param(req.params.id), req.user!.id))
}

export async function update(req: AuthRequest, res: Response) {
  const body = updateProjectSchema.parse(req.body)
  res.json(await projectsUsecase.updateProject(param(req.params.id), req.user!.id, body))
}

export async function remove(req: AuthRequest, res: Response) {
  await projectsUsecase.deleteProject(param(req.params.id), req.user!.id)
  res.status(204).send()
}
