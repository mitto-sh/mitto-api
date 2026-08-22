import { describe, it, expect, afterAll } from 'vitest'
import { deployQueue } from '@/queues/deploy'

describe('deployQueue', () => {
  afterAll(async () => {
    await deployQueue.close()
  })

  it('is a BullMQ queue named "deployments"', () => {
    expect(deployQueue.name).toBe('deployments')
  })

  it('accepts a job and reports it queued', async () => {
    const job = await deployQueue.add('deploy', {
      deploymentId: 'dep-1',
      serviceId: 'svc-1',
      projectId: 'proj-1',
    })

    expect(job.id).toBeDefined()
    expect(job.data.deploymentId).toBe('dep-1')

    await job.remove()
  })
})
