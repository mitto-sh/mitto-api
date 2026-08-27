import { AppError } from '@/middleware/error'
import { assertProjectOwner } from '@/usecases/ownership.usecase'
import * as servicesRepo from '@/repositories/services.repository'
import { serviceTeardownQueue } from '@/queues/serviceTeardown'
import type { CreateServiceInput, UpdateServiceInput } from '@/dto/services.dto'

async function getOwnedService(id: string, userId: string) {
  const service = await servicesRepo.findById(id)
  if (!service) throw new AppError(404, 'Service not found')
  await assertProjectOwner(service.projectId, userId)
  return service
}

export async function createService(userId: string, input: CreateServiceInput) {
  await assertProjectOwner(input.projectId, userId)
  return servicesRepo.insert(input)
}

export async function getService(id: string, userId: string) {
  return getOwnedService(id, userId)
}

export async function updateService(id: string, userId: string, input: UpdateServiceInput) {
  const service = await getOwnedService(id, userId)

  const isDisabling = input.enabled === false && service.enabled === true
  const updated = await servicesRepo.update(id, {
    ...input,
    ...(isDisabling ? { teardownStatus: 'tearing_down' } : {}),
  })

  if (isDisabling) {
    await serviceTeardownQueue.add('teardown', { serviceId: id })
  }

  return updated
}

export async function deleteService(id: string, userId: string) {
  const service = await getOwnedService(id, userId)
  await servicesRepo.remove(service.id)
}
