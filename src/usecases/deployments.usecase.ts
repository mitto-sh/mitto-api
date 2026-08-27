import jwt from 'jsonwebtoken'
import { AppError } from '@/middleware/error'
import { deployQueue } from '@/queues/deploy'
import { assertServiceOwner } from '@/usecases/ownership.usecase'
import { DeploymentStatus, CANCELLABLE_DEPLOYMENT_STATUSES } from '@/lib/consts'
import { env } from '@/config/env'
import * as deploymentsRepo from '@/repositories/deployments.repository'
import type { TriggerDeployInput } from '@/dto/deployments.dto'

export async function listDeployments(serviceId: string, userId: string, environmentId?: string) {
  await assertServiceOwner(serviceId, userId)
  return deploymentsRepo.findByService(serviceId, environmentId)
}

export async function triggerDeploy(userId: string, input: TriggerDeployInput) {
  const { service, project } = await assertServiceOwner(input.serviceId, userId)

  if (!service.enabled) throw new AppError(423, 'Service is disabled — enable it before deploying')
  if (!project.enabled) throw new AppError(423, 'Project is disabled — enable it before deploying')

  const deployment = await deploymentsRepo.insert({
    serviceId:     input.serviceId,
    environmentId: input.environmentId,
    status:        DeploymentStatus.Queued,
    commitSha:     input.commitSha,
    commitMessage: input.commitMessage,
    triggeredBy:   userId,
  })

  await deployQueue.add('deploy', {
    deploymentId:  deployment.id,
    serviceId:     service.id,
    projectId:     project.id,
    environmentId: input.environmentId,
  })

  return deployment
}

async function getOwnedDeployment(id: string, userId: string) {
  const deployment = await deploymentsRepo.findById(id)
  if (!deployment) throw new AppError(404, 'Deployment not found')
  await assertServiceOwner(deployment.serviceId, userId)
  return deployment
}

export async function getDeployment(id: string, userId: string) {
  return getOwnedDeployment(id, userId)
}

export async function getLogsToken(id: string, userId: string) {
  const deployment = await getOwnedDeployment(id, userId)
  const token = jwt.sign({ sub: userId, deploymentId: deployment.id }, env.JWT_SECRET, { expiresIn: '5m' })
  return { token }
}

export async function cancelDeployment(id: string, userId: string) {
  const deployment = await getOwnedDeployment(id, userId)

  if (!CANCELLABLE_DEPLOYMENT_STATUSES.includes(deployment.status)) {
    throw new AppError(400, `Cannot cancel a deployment with status: ${deployment.status}`)
  }

  return deploymentsRepo.update(deployment.id, { status: DeploymentStatus.Cancelled, finishedAt: new Date() })
}
