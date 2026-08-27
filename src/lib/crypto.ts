import { createCrypto } from 'mitto-lib-ts-orm'
import { env } from '@/config/env'

export const { encrypt, decrypt } = createCrypto(env.ENCRYPTION_KEY)
