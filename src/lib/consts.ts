export const CRYPTO_ALGORITHM = 'aes-256-gcm'
export const CRYPTO_IV_LENGTH = 12
export const CRYPTO_KEY_LENGTH = 32

export const MITTO_CONFIG_FILENAME = 'mitto.yaml'

export const GITHUB_INSTALL_STATE_TTL = '10m'

export const DeploymentStatus = {
  Queued: 'queued',
  Building: 'building',
  Pushing: 'pushing',
  Provisioning: 'provisioning',
  Cancelled: 'cancelled',
} as const

export const CANCELLABLE_DEPLOYMENT_STATUSES: string[] = [
  DeploymentStatus.Queued,
  DeploymentStatus.Building,
  DeploymentStatus.Pushing,
  DeploymentStatus.Provisioning,
]
