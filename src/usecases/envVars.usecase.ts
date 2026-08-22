import { encrypt, decrypt } from '@/lib/crypto'
import { assertServiceOwner } from '@/usecases/ownership.usecase'
import * as envVarsRepo from '@/repositories/envVars.repository'
import type { UpsertEnvVarInput } from '@/dto/envVars.dto'

export async function listEnvVars(serviceId: string, environmentId: string, userId: string) {
  await assertServiceOwner(serviceId, userId)

  const vars = await envVarsRepo.findByServiceAndEnvironment(serviceId, environmentId)

  return vars.map((v) => ({
    ...v,
    value: v.isSecret ? '***' : decrypt(v.value),
  }))
}

export async function upsertEnvVars(serviceId: string, userId: string, input: UpsertEnvVarInput) {
  await assertServiceOwner(serviceId, userId)

  const rows = input.vars.map((v) => ({
    serviceId,
    environmentId: input.environmentId,
    key:       v.key,
    value:     encrypt(v.value),
    isSecret:  v.isSecret,
  }))

  const upserted = await envVarsRepo.upsert(rows)

  return upserted.map((v) => ({ ...v, value: '***' }))
}

export async function deleteEnvVar(serviceId: string, environmentId: string, key: string, userId: string) {
  await assertServiceOwner(serviceId, userId)
  await envVarsRepo.remove(serviceId, environmentId, key)
}
