import { AppError } from '../middleware/error'
import { deployQueue } from '../queues/deploy'
import { assertServiceOwner } from '../lib/ownership'
import * as deploymentsRepo from '../repositories/deployments.repository'
import type { TriggerDeployInput } from '../dto/deployments.dto'

const CANCELLABLE_STATUSES = ['queued', 'building', 'pushing', 'provisioning']

export async function listDeployments(serviceId: string, environmentId?: string) {
  return deploymentsRepo.findByService(serviceId, environmentId)
}

export async function triggerDeploy(userId: string, input: TriggerDeployInput) {
  const { service, project } = await assertServiceOwner(input.serviceId, userId)

  if (!service.enabled) throw new AppError(423, 'Service is disabled — enable it before deploying')
  if (!project.enabled) throw new AppError(423, 'Project is disabled — enable it before deploying')

  const deployment = await deploymentsRepo.insert({
    serviceId:     input.serviceId,
    environmentId: input.environmentId,
    status:        'queued',
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

export async function getDeployment(id: string) {
  const deployment = await deploymentsRepo.findById(id)
  if (!deployment) throw new AppError(404, 'Deployment not found')
  return deployment
}

export async function cancelDeployment(id: string) {
  const deployment = await deploymentsRepo.findById(id)
  if (!deployment) throw new AppError(404, 'Deployment not found')

  if (!CANCELLABLE_STATUSES.includes(deployment.status)) {
    throw new AppError(400, `Cannot cancel a deployment with status: ${deployment.status}`)
  }

  return deploymentsRepo.update(deployment.id, { status: 'cancelled', finishedAt: new Date() })
}
