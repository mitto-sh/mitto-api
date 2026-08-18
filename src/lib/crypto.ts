import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { env } from '../config/env'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

const key = scryptSync(env.ENCRYPTION_KEY, 'mitto-salt', KEY_LENGTH)

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

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

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8')
}
