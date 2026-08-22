import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { env } from '@/config/env'
import { CRYPTO_ALGORITHM, CRYPTO_IV_LENGTH, CRYPTO_KEY_LENGTH } from '@/lib/consts'

const key = scryptSync(env.ENCRYPTION_KEY, 'mitto-salt', CRYPTO_KEY_LENGTH)

export function encrypt(plaintext: string): string {
  const iv = randomBytes(CRYPTO_IV_LENGTH)
  const cipher = createCipheriv(CRYPTO_ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':')

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid ciphertext format')
  }

  const iv        = Buffer.from(ivHex, 'hex')
  const tag       = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')

  const decipher = createDecipheriv(CRYPTO_ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
