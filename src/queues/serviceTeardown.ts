import { Queue } from 'bullmq'
import { env } from '@/config/env'

export interface ServiceTeardownJobData {
  serviceId: string
}

export const serviceTeardownQueue = new Queue<ServiceTeardownJobData>('service-teardown', {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 200 },
  },
})
