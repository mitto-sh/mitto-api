import { Queue } from 'bullmq'
import { env } from '../config/env'

export interface DeployJobData {
  deploymentId: string
  serviceId:    string
  projectId:    string
}

export const deployQueue = new Queue<DeployJobData>('deployments', {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 200 },
  },
})
